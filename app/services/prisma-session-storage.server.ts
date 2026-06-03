import { Session as ShopifySession } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import {
  Prisma,
  type PrismaClient,
  type Session as PrismaSession,
} from "@prisma/client";

const UNIQUE_KEY_CONSTRAINT_ERROR_CODE = "P2002";

function sessionToRow(session: ShopifySession): Prisma.SessionUncheckedCreateInput {
  const sessionParams = session.toObject();

  return {
    sessionKey: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: session.isOnline,
    scope: session.scope || null,
    expires: session.expires || null,
    accessToken: session.accessToken || "",
    userId:
      (sessionParams.onlineAccessInfo?.associated_user.id as unknown as bigint) ||
      null,
    firstName:
      sessionParams.onlineAccessInfo?.associated_user.first_name || null,
    lastName: sessionParams.onlineAccessInfo?.associated_user.last_name || null,
    email: sessionParams.onlineAccessInfo?.associated_user.email || null,
    accountOwner:
      sessionParams.onlineAccessInfo?.associated_user.account_owner || false,
    locale: sessionParams.onlineAccessInfo?.associated_user.locale || null,
    collaborator:
      sessionParams.onlineAccessInfo?.associated_user.collaborator || false,
    emailVerified:
      sessionParams.onlineAccessInfo?.associated_user.email_verified || false,
    refreshToken: sessionParams.refreshToken || null,
    refreshTokenExpires: sessionParams.refreshTokenExpires || null,
  };
}

function rowToSession(row: PrismaSession): ShopifySession {
  const sessionParams: Record<string, boolean | string | number> = {
    id: row.sessionKey,
    shop: row.shop,
    state: row.state,
    isOnline: row.isOnline,
  };

  if (row.userId !== null) {
    sessionParams.userId = String(row.userId);
  }

  if (row.firstName !== null) {
    sessionParams.firstName = row.firstName;
  }

  if (row.lastName !== null) {
    sessionParams.lastName = row.lastName;
  }

  if (row.email !== null) {
    sessionParams.email = row.email;
  }

  if (row.locale !== null) {
    sessionParams.locale = row.locale;
  }

  if (row.accountOwner !== null) {
    sessionParams.accountOwner = row.accountOwner;
  }

  if (row.collaborator !== null) {
    sessionParams.collaborator = row.collaborator;
  }

  if (row.emailVerified !== null) {
    sessionParams.emailVerified = row.emailVerified;
  }

  if (row.expires) {
    sessionParams.expires = row.expires.getTime();
  }

  if (row.scope) {
    sessionParams.scope = row.scope;
  }

  if (row.accessToken) {
    sessionParams.accessToken = row.accessToken;
  }

  if (row.refreshToken) {
    sessionParams.refreshToken = row.refreshToken;
  }

  if (row.refreshTokenExpires) {
    sessionParams.refreshTokenExpires = row.refreshTokenExpires.getTime();
  }

  return ShopifySession.fromPropertyArray(Object.entries(sessionParams), true);
}

export function createPrismaSessionStorage(
  prisma: PrismaClient,
): SessionStorage {
  return {
    async storeSession(session: ShopifySession): Promise<boolean> {
      const data = sessionToRow(session);

      try {
        await prisma.session.upsert({
          where: { sessionKey: session.id },
          update: data,
          create: data,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === UNIQUE_KEY_CONSTRAINT_ERROR_CODE
        ) {
          await prisma.session.upsert({
            where: { sessionKey: session.id },
            update: data,
            create: data,
          });
          return true;
        }
        throw error;
      }

      return true;
    },

    async loadSession(id: string): Promise<ShopifySession | undefined> {
      const row = await prisma.session.findUnique({
        where: { sessionKey: id },
      });

      if (!row) {
        return undefined;
      }

      return rowToSession(row);
    },

    async deleteSession(id: string): Promise<boolean> {
      try {
        await prisma.session.delete({ where: { sessionKey: id } });
      } catch {
        return true;
      }

      return true;
    },

    async deleteSessions(ids: string[]): Promise<boolean> {
      await prisma.session.deleteMany({
        where: { sessionKey: { in: ids } },
      });

      return true;
    },

    async findSessionsByShop(shop: string): Promise<ShopifySession[]> {
      const sessions = await prisma.session.findMany({
        where: { shop },
        take: 25,
        orderBy: [{ expires: "desc" }],
      });

      return sessions.map((session) => rowToSession(session));
    },
  };
}
