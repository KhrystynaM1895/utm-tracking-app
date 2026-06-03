import prisma from "../db.server";

export interface UtmCapturePayload {
  utmSourceId: number;
  landingUrl: string;
  referrer?: string | null;
  sessionId?: string | null;
  customerId?: string | null;
}

// Within this window, repeat visits from the same browser session to the same
// source are treated as one capture. Stops page refreshes / re-fires from
// inflating the table.
const DEDUP_WINDOW_MS = 30 * 60 * 1000;

export class UtmCaptureService {
  async createCapture(
    shop: string,
    payload: UtmCapturePayload,
  ): Promise<{ id: number }> {
    const { utmSourceId, landingUrl, referrer, sessionId, customerId } = payload;

    if (sessionId) {
      const existing = await prisma.utmCapture.findFirst({
        where: {
          shop,
          utmSourceId,
          sessionId,
          capturedAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
        },
        select: { id: true },
      });

      if (existing) {
        return existing;
      }
    }

    return prisma.utmCapture.create({
      data: {
        shop,
        utmSourceId,
        landingUrl,
        referrer: referrer ?? null,
        sessionId: sessionId ?? null,
        customerId: customerId ?? null,
      },
      select: { id: true },
    });
  }
}

export const utmCaptureService = new UtmCaptureService();
