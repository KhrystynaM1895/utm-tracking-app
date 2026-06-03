import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

/** Legacy Partner Dashboard redirect URL → real OAuth callback path. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const target = new URL(`/auth/callback${url.search}`, url.origin);

  throw redirect(target.toString());
};
