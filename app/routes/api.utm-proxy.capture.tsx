import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { utmCaptureService } from "../services/utm-capture.server";
import { utmSourceService } from "../services/utm-source.server";

function sanitizeSlug(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  return raw.trim().slice(0, 100);
}

function resolveShop(
  request: Request,
  sessionShop: string | undefined,
): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("shop") ?? sessionShop ?? null;
}

export const loader = async () => {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const context = await authenticate.public.appProxy(request);
  const shop = resolveShop(request, context.session?.shop);

  if (!shop) {
    return Response.json({ error: "Shop not found" }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const utms =
    data.utms && typeof data.utms === "object"
      ? (data.utms as Record<string, unknown>)
      : data;
  const slug = sanitizeSlug(utms.utm_source);

  if (!slug) {
    return Response.json({ error: "utm_source is required" }, { status: 422 });
  }

  const source = await utmSourceService.findByShopAndSlug(shop, slug);

  if (!source) {
    return Response.json({ error: "Unknown utm_source" }, { status: 422 });
  }

  const landingUrl =
    typeof data.landingUrl === "string" ? data.landingUrl.trim() : null;

  if (!landingUrl) {
    return Response.json({ error: "landingUrl is required" }, { status: 422 });
  }

  const url = new URL(request.url);

  await utmCaptureService.createCapture(shop, {
    utmSourceId: source.id,
    landingUrl: landingUrl.slice(0, 2048),
    referrer:
      typeof data.referrer === "string"
        ? data.referrer.trim().slice(0, 2048)
        : null,
    sessionId:
      typeof data.sessionId === "string"
        ? data.sessionId.trim().slice(0, 255)
        : null,
    customerId: url.searchParams.get("logged_in_customer_id"),
  });

  return Response.json({ ok: true, utmSourceId: source.id });
};
