-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PREPARING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY';

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

-- AlterTable: orders (rename columns from origin/main to canonical naming)
ALTER TABLE "orders" RENAME COLUMN "total_amount" TO "subtotal";
ALTER TABLE "orders" RENAME COLUMN "discount_amount" TO "discount";
ALTER TABLE "orders" RENAME COLUMN "final_amount" TO "total";

-- AlterTable: orders (add new columns)
ALTER TABLE "orders" ADD COLUMN "order_number" VARCHAR(50);
UPDATE "orders" SET "order_number" = 'ORD-' || replace(id::text, '-', '') WHERE "order_number" IS NULL OR btrim("order_number") = '';
ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

ALTER TABLE "orders" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "orders" ADD COLUMN "voucher_code" VARCHAR(50);
ALTER TABLE "orders" ADD COLUMN "notes" TEXT;

-- Update foreign key on orders (user_id): change from CASCADE to RESTRICT to protect financial records
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex on orders
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CHECK constraints on orders
ALTER TABLE "orders" ADD CONSTRAINT "orders_subtotal_check" CHECK ("subtotal" >= 0 AND "subtotal" <> 'NaN'::decimal);
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_check" CHECK ("discount" >= 0 AND "discount" <> 'NaN'::decimal);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check" CHECK ("total" >= 0 AND "total" <> 'NaN'::decimal);
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_lte_subtotal_check" CHECK ("discount" <= "subtotal");
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_balance_check" CHECK ("total" = "subtotal" - "discount");
ALTER TABLE "orders" ADD CONSTRAINT "orders_version_check" CHECK ("version" >= 1);
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_non_empty_check" CHECK (btrim("order_number") <> '');

-- AlterTable: order_items (rename columns to snapshot naming)
ALTER TABLE "order_items" RENAME COLUMN "product_name" TO "product_name_snapshot";
ALTER TABLE "order_items" RENAME COLUMN "unit_price" TO "unit_price_snapshot";

-- AlterTable: order_items (add new columns)
ALTER TABLE "order_items" ADD COLUMN "options_snapshot" JSONB;
ALTER TABLE "order_items" ADD COLUMN "notes" TEXT;
ALTER TABLE "order_items" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CHECK constraints on order_items
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_snapshot_check" CHECK ("unit_price_snapshot" >= 0 AND "unit_price_snapshot" <> 'NaN'::decimal);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subtotal_check" CHECK ("subtotal" >= 0 AND "subtotal" <> 'NaN'::decimal);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subtotal_calculation_check" CHECK ("subtotal" = "unit_price_snapshot" * "quantity");

-- CreateTable: order_item_options
CREATE TABLE "order_item_options" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "product_option_id" UUID NOT NULL,
    "option_name_snapshot" VARCHAR(100) NOT NULL,
    "option_type" "OptionType" NOT NULL,
    "extra_price_snapshot" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_item_options_order_item_id_product_option_id_key" ON "order_item_options"("order_item_id", "product_option_id");
CREATE INDEX "order_item_options_order_item_id_idx" ON "order_item_options"("order_item_id");
CREATE INDEX "order_item_options_product_option_id_idx" ON "order_item_options"("product_option_id");

-- AddForeignKey
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_product_option_id_fkey" FOREIGN KEY ("product_option_id") REFERENCES "product_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints on order_item_options
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_extra_price_snapshot_check" CHECK ("extra_price_snapshot" >= 0 AND "extra_price_snapshot" <> 'NaN'::decimal);
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_name_non_empty_check" CHECK (btrim("option_name_snapshot") <> '');

-- CreateTable: order_inventory_reservations
CREATE TABLE "order_inventory_reservations" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_inventory_reservations_order_id_key" ON "order_inventory_reservations"("order_id");
CREATE INDEX "order_inventory_reservations_status_idx" ON "order_inventory_reservations"("status");

-- AddForeignKey
ALTER TABLE "order_inventory_reservations" ADD CONSTRAINT "order_inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraints on order_inventory_reservations
ALTER TABLE "order_inventory_reservations" ADD CONSTRAINT "order_inventory_reservations_version_check" CHECK ("version" >= 1);
ALTER TABLE "order_inventory_reservations" ADD CONSTRAINT "order_inventory_reservations_status_timestamp_check" CHECK (
    ("status" = 'ACTIVE' AND "consumed_at" IS NULL AND "released_at" IS NULL) OR
    ("status" = 'CONSUMED' AND "consumed_at" IS NOT NULL AND "released_at" IS NULL) OR
    ("status" = 'RELEASED' AND "released_at" IS NOT NULL AND "consumed_at" IS NULL)
);

-- CreateTable: order_reservation_lines
CREATE TABLE "order_reservation_lines" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "order_reservation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_reservation_lines_reservation_id_ingredient_id_key" ON "order_reservation_lines"("reservation_id", "ingredient_id");
CREATE INDEX "order_reservation_lines_ingredient_id_idx" ON "order_reservation_lines"("ingredient_id");

-- AddForeignKey
ALTER TABLE "order_reservation_lines" ADD CONSTRAINT "order_reservation_lines_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "order_inventory_reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_reservation_lines" ADD CONSTRAINT "order_reservation_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints on order_reservation_lines
ALTER TABLE "order_reservation_lines" ADD CONSTRAINT "order_reservation_lines_amount_check" CHECK ("amount" > 0 AND "amount" <> 'NaN'::decimal);

-- CreateTable: order_status_history
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "actor_id" UUID,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
