# UTM Tracking App

A Shopify app that tracks `utm_source` campaign slugs from storefront visits through checkout to order attribution. Merchants register UTM sources in the admin, enable a theme app embed on the storefront, and view capture events and order reports.

Built with [React Router](https://reactrouter.com/), [@shopify/shopify-app-react-router](https://shopify.dev/docs/api/shopify-app-react-router), and [Prisma](https://www.prisma.io/) (PostgreSQL).

## Features

- Register `utm_source` slugs per shop (e.g. `instagram`, `google-ads`)
- Capture storefront visits via a theme app embed and app proxy
- Persist UTM data in cart attributes and line item properties
- Copy UTM source to order metafields on checkout
- Attribute orders to UTM sources for reporting
- GDPR-compliant data handling (customer/shop redaction webhooks)

---

## How to run it

### Prerequisites

- [Node.js](https://nodejs.org/) `>=20.19 <22` or `>=22.12`
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli/getting-started)
- [Docker](https://www.docker.com/) (for local PostgreSQL) or another PostgreSQL instance
- A [Shopify Partner account](https://partners.shopify.com/) and a development store

### 1. Install dependencies

```shell
npm install
```

This installs the root app and workspace extensions under `extensions/*`.

### 2. Start PostgreSQL

The app uses PostgreSQL (not SQLite). Start the bundled database with Docker Compose:

```shell
docker compose up -d
```

This runs PostgreSQL on port **5433** with:

| Setting  | Value          |
| -------- | -------------- |
| User     | `utm`          |
| Password | `utm`          |
| Database | `utm_tracking` |
| URL      | `postgresql://utm:utm@localhost:5433/utm_tracking` |

### 3. Configure environment variables

The Shopify CLI sets most variables automatically during `shopify app dev`. For manual setup or production, configure:

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `DATABASE_URL`        | PostgreSQL connection string                     |
| `SHOPIFY_API_KEY`     | App API key from Partner Dashboard               |
| `SHOPIFY_API_SECRET`  | App API secret (required — app refuses to start without it) |
| `SHOPIFY_APP_URL`     | Public URL of the app (tunnel URL in dev)        |
| `SCOPES`              | `write_app_proxy,write_orders`                   |
| `SHOP_CUSTOM_DOMAIN`  | Optional custom shop domain                      |
| `NODE_ENV`            | Set to `production` when deployed                |

Example for local development:

```shell
export DATABASE_URL="postgresql://utm:utm@localhost:5433/utm_tracking"
```

### 4. Run database migrations

```shell
npm run setup
```

This runs `prisma generate` and `prisma migrate deploy`, creating the `sessions`, `utm_sources`, `utm_captures`, and `utm_orders` tables.

### 5. Start local development

```shell
npm run dev
# or
shopify app dev
```

The CLI will:

- Log into your Partner account
- Link or create the app
- Start a tunnel and set `SHOPIFY_APP_URL`
- Run Prisma migrations before starting the dev server
- Deploy extensions to your dev store

Press **P** in the terminal to open the app URL, then install the app on your development store.

### 6. Enable the theme app embed

After the app is installed:

1. Open the app admin home page (**Sources**)
2. Click **Activate UTM Tracking app embed**, or go to **Online Store → Themes → Customize → App embeds** and enable **UTM Tracking**
3. Register at least one UTM source slug (e.g. `instagram`)

### 7. Test the flow

Visit your storefront with a registered slug:

```
https://your-store.myshopify.com/?utm_source=instagram
```

Then verify:

- A row appears on **Captures** in the app admin
- Cart attributes include `utm_source=instagram`
- After placing an order, the order metafield `custom.utm_source` is set
- **Reports** shows the attributed order count

### Production build and deployment

**Build:**

```shell
npm run build
```

**Start (after build):**

```shell
npm run start
```

**Docker:**

```shell
docker build -t utm-tracking-app .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e SHOPIFY_API_KEY="..." \
  -e SHOPIFY_API_SECRET="..." \
  -e SHOPIFY_APP_URL="https://your-app.example.com" \
  -e SCOPES="write_app_proxy,write_orders" \
  -e NODE_ENV=production \
  utm-tracking-app
```

The Docker image runs `npm run setup` (migrations) then `npm run start`.

**Deploy extensions and app config to Shopify:**

```shell
npm run deploy
```

See [Shopify deployment docs](https://shopify.dev/docs/apps/launch/deployment) for hosting options (Google Cloud Run, Fly.io, Render, etc.).

### Useful scripts

| Script            | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start Shopify CLI dev server             |
| `npm run build`   | Production build                         |
| `npm run start`   | Serve production build                   |
| `npm run setup`   | Generate Prisma client + run migrations  |
| `npm run deploy`  | Deploy app and extensions to Shopify     |
| `npm run lint`    | Run ESLint                               |
| `npm run typecheck` | Type-check the app                     |

---

## How it works

### Architecture overview

```mermaid
flowchart LR
  subgraph Storefront
    URL["URL ?utm_source=slug"]
    Embed["Theme app embed\nutm-capture.js"]
    Cart["Cart attributes\n+ line item properties"]
  end

  subgraph AppProxy["App proxy /apps/utm-tracking/*"]
    Sources["GET /sources"]
    Capture["POST /capture"]
  end

  subgraph Backend["React Router app"]
    Admin["Admin UI"]
    Webhook["Webhooks"]
    DB[(PostgreSQL)]
  end

  subgraph Checkout
    CheckoutExt["Checkout UI extension"]
    Order["Order + metafield\ncustom.utm_source"]
  end

  URL --> Embed
  Embed --> Sources
  Embed --> Capture
  Embed --> Cart
  Sources --> DB
  Capture --> DB
  Cart --> CheckoutExt
  CheckoutExt --> Order
  Order --> Webhook
  Webhook --> DB
  Admin --> DB
```

### End-to-end flow

1. **Register sources** — The merchant creates UTM source slugs in the admin (`/app`). Each slug maps to a database row with a unique integer ID per shop.

2. **Storefront capture** — The theme app embed (`extensions/utm-tracker`) runs on every page when enabled:
   - Reads `?utm_source=` from the URL
   - Fetches registered slugs from the app proxy (`GET /apps/utm-tracking/sources`)
   - Ignores unknown slugs
   - Posts a capture event (`POST /apps/utm-tracking/capture`)
   - Saves the source slug in `sessionStorage` / `localStorage`
   - Sets cart attribute `utm_source` and line item property `_utm_source`

3. **Checkout** — The checkout UI extension (`extensions/utm-checkout`) reads the UTM slug from line item properties or `localStorage` and sets the checkout attribute `utm_source`.

4. **Order creation** — The `orders/create` webhook handler:
   - Reads `utm_source` from order `note_attributes` (cart flow) or line item properties (Buy now flow)
   - Writes the value to order metafield `custom.utm_source` via Admin GraphQL
   - Records an `utm_orders` row linking the order to the source

5. **Reporting** — The **Reports** page aggregates order counts per UTM source. **Captures** lists recent storefront visit events.

### Admin UI

| Route               | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `/app`              | Register UTM sources, setup instructions     |
| `/app/utm-captures` | View last 100 storefront capture events      |
| `/app/reports`      | Order counts grouped by UTM source           |

Navigation is defined in `app/routes/app.tsx`.

### App proxy API

Configured in `shopify.app.toml`:

```toml
[app_proxy]
url = "/api/utm-proxy"
prefix = "apps"
subpath = "utm-tracking"
```

Storefront requests are proxied to the backend with HMAC verification:

| Storefront path                      | Backend route                         | Method | Purpose                          |
| ------------------------------------ | ------------------------------------- | ------ | -------------------------------- |
| `/apps/utm-tracking/sources`         | `api.utm-proxy.sources.tsx`           | GET    | Return `{ sources: { slug: id } }` |
| `/apps/utm-tracking/capture`         | `api.utm-proxy.capture.tsx`           | POST   | Record a capture event           |

The capture endpoint accepts:

```json
{
  "utms": { "utm_source": "instagram" },
  "landingUrl": "https://store.com/?utm_source=instagram",
  "referrer": "https://google.com",
  "sessionId": "uuid"
}
```

**Deduplication:** Repeat captures from the same browser session and source within 30 minutes are ignored to prevent inflation from page refreshes.

### Webhooks

All webhooks are handled at `/api/shopify/webhook` (declared in `shopify.app.toml`):

| Topic                    | Behavior                                              |
| ------------------------ | ----------------------------------------------------- |
| `app/uninstalled`        | Delete OAuth sessions for the shop                    |
| `app/scopes_update`      | Update stored session scopes                          |
| `orders/create`          | Write order metafield + create `utm_orders` record    |
| `customers/data_request` | Log stored capture data for GDPR compliance           |
| `customers/redact`       | Delete captures linked to the customer                |
| `shop/redact`            | Purge all shop data (sources, captures, orders, sessions) |

On install/re-auth, the `afterAuth` hook creates and pins the `custom.utm_source` order metafield definition via Admin GraphQL.

### Database schema

PostgreSQL schema in `prisma/schema.prisma`:

| Model        | Purpose                                              |
| ------------ | ---------------------------------------------------- |
| `Session`    | Shopify OAuth sessions (Prisma session storage)      |
| `UtmSource`  | Registered slugs per shop (`@@unique([shop, slug])`) |
| `UtmCapture` | Storefront visit events                              |
| `UtmOrder`   | Orders attributed to a UTM source                    |

Relationships:

- `UtmCapture` → `UtmSource` (many-to-one)
- `UtmOrder` → `UtmSource` (many-to-one)

### Extensions

| Extension       | Type              | Location                         | Role                                      |
| --------------- | ----------------- | -------------------------------- | ----------------------------------------- |
| `utm-tracker`   | Theme app embed   | `extensions/utm-tracker/`        | Capture UTM on storefront, sync cart      |
| `utm-checkout`  | Checkout UI       | `extensions/utm-checkout/`       | Copy UTM slug to checkout attributes      |

The theme embed injects `utm-capture.js`, which:

- Caches the source slug→id map for 5 minutes in `sessionStorage`
- Generates a per-tab session ID for deduplication
- Injects hidden `_utm_source` inputs into add-to-cart forms
- Syncs existing cart line items with the current UTM slug

### Key services

| Service                    | File                                   | Responsibility                    |
| -------------------------- | -------------------------------------- | --------------------------------- |
| `UtmSourceService`         | `app/services/utm-source.server.ts`    | Slug validation, CRUD, slug map   |
| `UtmCaptureService`        | `app/services/utm-capture.server.ts`   | Capture creation with dedup       |
| `ensureUtmMetafieldDefinition` | `app/services/utm-metafield.server.ts` | Order metafield setup on auth |

### Required Shopify scopes

```
write_app_proxy, write_orders
```

- `write_app_proxy` — Storefront capture and sources API via app proxy
- `write_orders` — Write `custom.utm_source` order metafield on order creation

### Project structure

```
app/
  routes/
    app._index.tsx              # UTM source management
    app.utm-captures.tsx        # Capture event list
    app.reports.tsx             # Order attribution report
    api.utm-proxy.capture.tsx   # App proxy: record capture
    api.utm-proxy.sources.tsx   # App proxy: list sources
    api.shopify.webhook.tsx     # All webhook handlers
  services/                     # Business logic
  shopify.server.ts             # Shopify app config + afterAuth hook
extensions/
  utm-tracker/                  # Theme app embed
  utm-checkout/                 # Checkout UI extension
prisma/
  schema.prisma                 # Database schema
  migrations/                   # SQL migrations
shopify.app.toml                # App config, scopes, webhooks, app proxy
docker-compose.yml              # Local PostgreSQL
```

---

## Troubleshooting

### Database tables don't exist

Run migrations:

```shell
npm run setup
```

### App refuses to start: `SHOPIFY_API_SECRET is not set`

Set `SHOPIFY_API_SECRET` in your environment. The app intentionally fails fast without it to prevent unverified webhook/proxy requests.

### Captures not appearing

1. Confirm the theme app embed is enabled in the theme editor
2. Confirm the UTM slug is registered in the admin **Sources** page
3. Confirm the app has the `write_app_proxy` scope (re-install if needed)
4. Check that app proxy paths match the theme embed settings (defaults: `/apps/utm-tracking/capture` and `/apps/utm-tracking/sources`)

### Orders not attributed in Reports

1. Confirm the checkout UI extension is deployed (`npm run deploy`)
2. Verify cart attributes or line item properties contain `utm_source` before checkout
3. Check server logs for `orders/create` webhook errors or missing admin session

### Embedded app navigation issues

Use `Link` from `react-router` or Polaris — not raw `<a>` tags. Use `redirect` from `authenticate.admin`, not from `react-router`.

---

## Resources

- [Shopify App React Router docs](https://shopify.dev/docs/api/shopify-app-react-router)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [App proxy](https://shopify.dev/docs/apps/build/online-store/app-proxies)
- [Theme app extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions)
- [Checkout UI extensions](https://shopify.dev/docs/api/checkout-ui-extensions)
- [React Router docs](https://reactrouter.com/home)
