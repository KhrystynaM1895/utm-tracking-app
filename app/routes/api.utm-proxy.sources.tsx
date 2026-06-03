import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { utmSourceService } from "../services/utm-source.server";

function resolveShop(
  request: Request,
  sessionShop: string | undefined,
): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("shop") ?? sessionShop ?? null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await authenticate.public.appProxy(request);
  const shop = resolveShop(request, context.session?.shop);

  if (!shop) {
    return Response.json({ error: "Shop not found" }, { status: 400 });
  }

  const sources = await utmSourceService.slugMapByShop(shop);

  return Response.json({ sources });
};
