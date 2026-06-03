import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const rows = await prisma.utmSource.findMany({
    where: { shop: session.shop },
    select: {
      slug: true,
      name: true,
      _count: { select: { orders: true } },
    },
    orderBy: { orders: { _count: "desc" } },
  });

  return { rows };
};

export default function Reports() {
  const { rows } = useLoaderData<typeof loader>();
  const hasOrders = rows.some((r) => r._count.orders > 0);

  return (
    <s-page heading="UTM Report">
      {!hasOrders ? (
        <s-paragraph>No orders attributed yet.</s-paragraph>
      ) : (
        <s-table>
          <s-table-header-row>
            <s-table-header>Source</s-table-header>
            <s-table-header>Orders</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {rows.map((r) => (
              <s-table-row key={r.slug}>
                <s-table-cell>{r.name ?? r.slug}</s-table-cell>
                <s-table-cell>{r._count.orders}</s-table-cell>
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
