-- Drop indexes redundant with the leftmost prefix of existing composite
-- unique constraints ([shop, slug] and [shop, order_id]).
DROP INDEX IF EXISTS "utm_sources_shop_idx";
DROP INDEX IF EXISTS "utm_orders_shop_idx";
