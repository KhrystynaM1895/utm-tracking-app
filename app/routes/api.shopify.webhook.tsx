import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { utmSourceService } from "../services/utm-source.server";
import db from "../db.server";

type NameValue = { name: string; value: string };

type OrderPayload = {
  id: number;
  note_attributes: NameValue[];
  line_items: Array<{ properties: NameValue[] }>;
};

type CustomerRedactPayload = {
  shop_domain: string;
  customer: { id: number; email?: string };
};

const METAFIELDS_SET = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key value }
      userErrors { field message code }
    }
  }
`;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, session, admin } =
    await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "APP_UNINSTALLED":
      // Remove auth sessions. Shop data (sources/captures/orders) is purged
      // separately via the SHOP_REDACT compliance webhook so a re-install can
      // still recover it within Shopify's retention window.
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }
      break;

    case "APP_SCOPES_UPDATE": {
      const scopes = (payload as { current: string[] }).current;
      if (session) {
        await db.session.update({
          where: { sessionKey: session.id },
          data: { scope: scopes.toString() },
        });
      }
      break;
    }

    // GDPR / mandatory compliance webhooks ------------------------------------

    case "CUSTOMERS_DATA_REQUEST": {
      // We have no automated delivery channel, so surface the stored data in
      // logs for the merchant to fulfil the request manually.
      const customerId = String(
        (payload as CustomerRedactPayload).customer?.id ?? "",
      );
      if (customerId) {
        const captures = await db.utmCapture.findMany({
          where: { shop, customerId },
          select: {
            id: true,
            landingUrl: true,
            referrer: true,
            sessionId: true,
            capturedAt: true,
          },
        });
        console.log(
          `[gdpr] data_request ${shop} customer=${customerId}: ${captures.length} captures`,
          captures,
        );
      }
      break;
    }

    case "CUSTOMERS_REDACT": {
      const customerId = String(
        (payload as CustomerRedactPayload).customer?.id ?? "",
      );
      if (customerId) {
        const { count } = await db.utmCapture.deleteMany({
          where: { shop, customerId },
        });
        console.log(
          `[gdpr] redact ${shop} customer=${customerId}: deleted ${count} captures`,
        );
      }
      break;
    }

    case "SHOP_REDACT": {
      // Purge all shop-owned data. Captures/orders first because UtmSource
      // FKs use onDelete: Restrict.
      await db.utmCapture.deleteMany({ where: { shop } });
      await db.utmOrder.deleteMany({ where: { shop } });
      await db.utmSource.deleteMany({ where: { shop } });
      await db.session.deleteMany({ where: { shop } });
      console.log(`[gdpr] shop_redact ${shop}: all data purged`);
      break;
    }

    case "ORDERS_CREATE": {
      const raw = payload as Record<string, unknown>;
      if (typeof raw.id !== "number") break;

      const order = raw as unknown as OrderPayload;
      const noteAttrs = Array.isArray(raw.note_attributes) ? order.note_attributes : [];
      const lineItems = Array.isArray(raw.line_items) ? order.line_items : [];

      // note_attributes → cart attribute flow (Add to cart)
      // line_items[].properties → line item property flow (Buy now)
      const utmAttr =
        noteAttrs.find((a) => a.name === "utm_source") ??
        lineItems.flatMap((l) => l.properties ?? []).find(
          (p) => p.name === "utm_source" || p.name === "_utm_source",
        );

      if (!utmAttr) break;

      if (!admin) {
        console.warn(`No admin session for ${shop} — skipping metafield write`);
        break;
      }

      const response = await admin.graphql(METAFIELDS_SET, {
        variables: {
          metafields: [
            {
              ownerId: `gid://shopify/Order/${order.id}`,
              namespace: "custom",
              key: "utm_source",
              type: "single_line_text_field",
              value: utmAttr.value,
            },
          ],
        },
      });

      const { data } = await response.json();
      const errors = data?.metafieldsSet?.userErrors ?? [];
      if (errors.length > 0) {
        console.error("metafieldsSet userErrors:", errors);
      }

      if (errors.length === 0) {
        // Stored slugs are normalized (lowercase); normalize the inbound
        // attribute value before looking it up.
        const slug = utmSourceService.normalizeSlug(utmAttr.value);
        const source = await db.utmSource.findUnique({
          where: { shop_slug: { shop, slug } },
          select: { id: true },
        });

        if (source) {
          await db.utmOrder.upsert({
            where: { shop_orderId: { shop, orderId: String(order.id) } },
            create: {
              shop,
              orderId: String(order.id),
              utmSourceId: source.id,
            },
            update: {}, // idempotent — don't overwrite on webhook retry
          });
        }
      }
      break;
    }
  }

  return new Response();
};
