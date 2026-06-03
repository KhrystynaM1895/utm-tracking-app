-- CreateTable
CREATE TABLE IF NOT EXISTS "utm_orders" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "utm_source_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utm_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "utm_orders_shop_idx" ON "utm_orders"("shop");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "utm_orders_utm_source_id_idx" ON "utm_orders"("utm_source_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "utm_orders_shop_order_id_key" ON "utm_orders"("shop", "order_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "utm_orders" ADD CONSTRAINT "utm_orders_utm_source_id_fkey" FOREIGN KEY ("utm_source_id") REFERENCES "utm_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
