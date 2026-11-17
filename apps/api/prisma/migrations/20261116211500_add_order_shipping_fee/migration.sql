-- AlterTable: add shipping_fee column to orders and align total balance check
ALTER TABLE "orders" ADD COLUMN "shipping_fee" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_fee_check"
CHECK ("shipping_fee" >= 0 AND "shipping_fee" <> 'NaN'::decimal);

ALTER TABLE "orders" DROP CONSTRAINT "orders_total_balance_check";

ALTER TABLE "orders" ADD CONSTRAINT "orders_total_balance_check"
CHECK ("total" = "subtotal" - "discount" + "shipping_fee");
