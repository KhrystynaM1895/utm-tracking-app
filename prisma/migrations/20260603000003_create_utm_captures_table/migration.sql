-- CreateTable
CREATE TABLE IF NOT EXISTS "utm_captures" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "utm_source_id" INTEGER NOT NULL,
    "landing_url" TEXT NOT NULL,
    "referrer" TEXT,
    "session_id" TEXT,
    "customer_id" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utm_captures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "utm_captures_shop_captured_at_idx" ON "utm_captures"("shop", "captured_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "utm_captures_utm_source_id_idx" ON "utm_captures"("utm_source_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "utm_captures" ADD CONSTRAINT "utm_captures_utm_source_id_fkey" FOREIGN KEY ("utm_source_id") REFERENCES "utm_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
