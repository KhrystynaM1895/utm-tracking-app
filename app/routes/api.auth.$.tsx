import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

/** Legacy Partner Dashboard redirect paths under /api/auth/* → /auth/callback. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const suffix = url.pathname.replace(/^\/api\/auth\/?/, "");
  const callbackPath = suffix
    ? `/auth/${suffix}${url.search}`
    : `/auth/callback${url.search}`;

  throw redirect(new URL(callbackPath, url.origin).toString());
};
