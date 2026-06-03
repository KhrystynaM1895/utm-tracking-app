-- CreateTable
CREATE TABLE IF NOT EXISTS "utm_sources" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utm_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "utm_sources_shop_idx" ON "utm_sources"("shop");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "utm_sources_shop_slug_key" ON "utm_sources"("shop", "slug");
