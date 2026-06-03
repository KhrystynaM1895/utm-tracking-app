import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { createPrismaSessionStorage } from "./services/prisma-session-storage.server";
import { ensureUtmMetafieldDefinition } from "./services/utm-metafield.server";
import prisma from "./db.server";

const apiSecretKey = process.env.SHOPIFY_API_SECRET;

if (!apiSecretKey) {
  // Fail fast: an empty secret silently disables HMAC verification for
  // webhooks and app proxy requests, which is a security hole.
  throw new Error(
    "SHOPIFY_API_SECRET is not set. Refusing to start without a valid app secret.",
  );
}

const API_VERSION = ApiVersion.October25;

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey,
  apiVersion: API_VERSION,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: createPrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // Run once per OAuth completion (install / re-auth) instead of on every
      // admin page load.
      await ensureUtmMetafieldDefinition(admin, session.shop);
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = API_VERSION;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
