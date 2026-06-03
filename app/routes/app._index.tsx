import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { utmSourceService } from "../services/utm-source.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = session.shop;
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const activateEmbedUrl = `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/utm-capture`;
  const sources = await utmSourceService.listByShop(shop);

  return {
    shop,
    activateEmbedUrl,
    sources,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "create-source") {
    return { error: "Invalid action." };
  }

  const slug = formData.get("slug");
  const name = formData.get("name");

  if (typeof slug !== "string") {
    return { error: "Slug is required.", slug: "", name: "" };
  }

  try {
    await utmSourceService.create(session.shop, {
      slug,
      name: typeof name === "string" ? name : null,
    });

    return { success: true, error: null, slug: "", name: "" };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create source.",
      slug,
      name: typeof name === "string" ? name : "",
    };
  }
};

export default function Index() {
  const { shop, activateEmbedUrl, sources } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="UTM Tracking">
      <s-section heading="UTM sources">
        <s-paragraph>
          Register slugs before using them on the storefront. Links use{" "}
          <code>?utm_source=your-slug</code>. Captures store the matching
          integer source id.
        </s-paragraph>

        <Form method="post">
          <input type="hidden" name="intent" value="create-source" />
          <s-text-field
            name="slug"
            label="Slug"
            details="Lowercase letters, numbers, hyphens, underscores. Example: instagram"
            value={actionData?.slug ?? ""}
            error={actionData?.error ?? undefined}
          />
          <s-text-field
            name="name"
            label="Display name (optional)"
            value={actionData?.name ?? ""}
          />
          <s-button type="submit">Add source</s-button>
        </Form>

        {actionData?.success ? (
          <s-paragraph>Source created successfully.</s-paragraph>
        ) : null}

        {sources.length === 0 ? (
          <s-paragraph>No sources registered yet.</s-paragraph>
        ) : (
          <s-unordered-list>
            {sources.map((source) => {
              const testUrl = `https://${shop}/?utm_source=${source.slug}`;

              return (
                <s-list-item key={source.id}>
                  <strong>#{source.id}</strong> — <code>{source.slug}</code>
                  {source.name ? ` (${source.name})` : ""}
                  {" · "}
                  <a href={testUrl} target="_blank" rel="noreferrer">
                    Test link
                  </a>
                </s-list-item>
              );
            })}
          </s-unordered-list>
        )}
      </s-section>

      <s-section heading="Setup">
        <s-paragraph>
          Enable the theme app embed to capture registered <code>utm_source</code>{" "}
          slugs from storefront URLs, persist the matching id in the browser,
          attach it to cart attributes, and send capture events to this app.
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>
            Run <code>shopify app dev</code> or deploy the app so the theme
            extension is available.
          </s-list-item>
          <s-list-item>
            Open the theme editor and enable{" "}
            <strong>Theme settings → App embeds → UTM Tracking</strong>, or use
            the activation link below.
          </s-list-item>
          <s-list-item>
            Re-install or re-authenticate the app if prompted for the{" "}
            <code>write_app_proxy</code> scope.
          </s-list-item>
          <s-list-item>
            Visit your storefront with a registered <code>utm_source</code> slug
            and verify cart attributes and database captures.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Quick links">
        <s-paragraph>
          Store: <code>{shop}</code>
        </s-paragraph>
        <s-paragraph>
          <a href={activateEmbedUrl} target="_top">
            Activate UTM Tracking app embed
          </a>
        </s-paragraph>
        <s-paragraph>
          <a href="/app/utm-captures">View UTM Captures</a>
        </s-paragraph>
      </s-section>

      <s-section heading="What gets captured">
        <s-unordered-list>
          <s-list-item>
            Query param: registered <code>utm_source</code> slug only
          </s-list-item>
          <s-list-item>
            Stored as integer id in browser storage and cart attributes
          </s-list-item>
          <s-list-item>
            Backend capture via app proxy at{" "}
            <code>/apps/utm-tracking/capture</code>
          </s-list-item>
          <s-list-item>
            Unknown slugs are ignored on the storefront and rejected by the API
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
