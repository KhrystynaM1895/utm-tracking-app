import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const captures = await prisma.utmCapture.findMany({
    where: { shop: session.shop },
    orderBy: { capturedAt: "desc" },
    take: 100,
    include: {
      utmSource: { select: { slug: true, name: true } },
    },
  });

  return { captures };
};

export default function UtmCaptures() {
  const { captures } = useLoaderData<typeof loader>();

  return (
    <s-page heading="UTM Captures">
      {captures.length === 0 ? (
        <s-paragraph>No captures yet.</s-paragraph>
      ) : (
        <s-table>
          <s-table-header-row>
            <s-table-header>ID</s-table-header>
            <s-table-header>Source</s-table-header>
            <s-table-header>Landing URL</s-table-header>
            <s-table-header>Referrer</s-table-header>
            <s-table-header>Session ID</s-table-header>
            <s-table-header>Customer ID</s-table-header>
            <s-table-header>Captured at</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {captures.map((capture) => (
              <s-table-row key={capture.id}>
                <s-table-cell>{capture.id}</s-table-cell>
                <s-table-cell>
                  {capture.utmSource.name ?? capture.utmSource.slug}
                </s-table-cell>
                <s-table-cell>{capture.landingUrl}</s-table-cell>
                <s-table-cell>{capture.referrer ?? ""}</s-table-cell>
                <s-table-cell>{capture.sessionId ?? ""}</s-table-cell>
                <s-table-cell>{capture.customerId ?? ""}</s-table-cell>
                <s-table-cell>
                  {capture.capturedAt.toLocaleString()}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
