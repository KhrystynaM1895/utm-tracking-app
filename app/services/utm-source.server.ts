import prisma from "../db.server";

const SLUG_PATTERN = /^[a-z0-9_-]+$/;

export interface CreateUtmSourceInput {
  slug: string;
  name?: string | null;
}

export class UtmSourceService {
  normalizeSlug(slug: string): string {
    return slug.trim().toLowerCase();
  }

  validateSlug(slug: string): string | null {
    const normalized = this.normalizeSlug(slug);

    if (!normalized) {
      return "Slug is required.";
    }

    if (normalized.length > 100) {
      return "Slug must be 100 characters or fewer.";
    }

    if (!SLUG_PATTERN.test(normalized)) {
      return "Slug may only contain lowercase letters, numbers, hyphens, and underscores.";
    }

    return null;
  }

  async listByShop(shop: string) {
    return prisma.utmSource.findMany({
      where: { shop },
      orderBy: { id: "asc" },
    });
  }

  async create(shop: string, input: CreateUtmSourceInput) {
    const slugError = this.validateSlug(input.slug);

    if (slugError) {
      throw new Error(slugError);
    }

    const slug = this.normalizeSlug(input.slug);
    const name = input.name?.trim() || null;

    const existing = await prisma.utmSource.findUnique({
      where: {
        shop_slug: { shop, slug },
      },
    });

    if (existing) {
      throw new Error(`Source "${slug}" already exists for this shop.`);
    }

    return prisma.utmSource.create({
      data: {
        shop,
        slug,
        name,
      },
    });
  }

  async findByShopAndSlug(shop: string, slug: string) {
    return prisma.utmSource.findUnique({
      where: {
        shop_slug: {
          shop,
          slug: this.normalizeSlug(slug),
        },
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });
  }

  async slugMapByShop(shop: string): Promise<Record<string, number>> {
    const sources = await prisma.utmSource.findMany({
      where: { shop },
      select: { id: true, slug: true },
    });

    return Object.fromEntries(sources.map(({ slug, id }) => [slug, id]));
  }
}

export const utmSourceService = new UtmSourceService();
