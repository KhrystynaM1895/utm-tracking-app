import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { login } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function Index() {
  return (
    <s-page>
      <s-section heading="utm-tracking-app">
        <s-paragraph>
          Open this app from the Shopify admin or use the CLI preview URL to
          install it.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
