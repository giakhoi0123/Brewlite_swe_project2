-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
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

-- CreateTable
CREATE TABLE "order_reservation_lines" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "order_reservation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
CREATE UNIQUE INDEX "order_inventory_reservations_order_id_key" ON "order_inventory_reservations"("order_id");

-- CreateIndex
CREATE INDEX "order_inventory_reservations_status_idx" ON "order_inventory_reservations"("status");

-- CreateIndex
CREATE INDEX "order_reservation_lines_ingredient_id_idx" ON "order_reservation_lines"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_reservation_lines_reservation_id_ingredient_id_key" ON "order_reservation_lines"("reservation_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_options_order_item_id_product_option_id_key" ON "order_item_options"("order_item_id", "product_option_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_inventory_reservations" ADD CONSTRAINT "order_inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_reservation_lines" ADD CONSTRAINT "order_reservation_lines_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "order_inventory_reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_reservation_lines" ADD CONSTRAINT "order_reservation_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraints for orders
ALTER TABLE "orders" ADD CONSTRAINT "orders_subtotal_check" CHECK ("subtotal" >= 0 AND "subtotal" <> 'NaN'::decimal);
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_check" CHECK ("discount" >= 0 AND "discount" <> 'NaN'::decimal);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check" CHECK ("total" >= 0 AND "total" <> 'NaN'::decimal);
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_lte_subtotal_check" CHECK ("discount" <= "subtotal");
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_balance_check" CHECK ("total" = "subtotal" - "discount");
ALTER TABLE "orders" ADD CONSTRAINT "orders_version_check" CHECK ("version" >= 1);
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_non_empty_check" CHECK (btrim("order_number") <> '');

-- CHECK constraints for order_items
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_snapshot_check" CHECK ("unit_price_snapshot" >= 0 AND "unit_price_snapshot" <> 'NaN'::decimal);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subtotal_check" CHECK ("subtotal" >= 0 AND "subtotal" <> 'NaN'::decimal);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subtotal_calculation_check" CHECK ("subtotal" = "unit_price_snapshot" * "quantity");

-- CHECK constraints for order_item_options
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_extra_price_snapshot_check" CHECK ("extra_price_snapshot" >= 0 AND "extra_price_snapshot" <> 'NaN'::decimal);
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_name_non_empty_check" CHECK (btrim("option_name_snapshot") <> '');

-- CHECK constraints for order_inventory_reservations
ALTER TABLE "order_inventory_reservations" ADD CONSTRAINT "order_inventory_reservations_version_check" CHECK ("version" >= 1);
ALTER TABLE "order_inventory_reservations" ADD CONSTRAINT "order_inventory_reservations_status_timestamp_check" CHECK (
    ("status" = 'ACTIVE' AND "consumed_at" IS NULL AND "released_at" IS NULL) OR
    ("status" = 'CONSUMED' AND "consumed_at" IS NOT NULL AND "released_at" IS NULL) OR
    ("status" = 'RELEASED' AND "released_at" IS NOT NULL AND "consumed_at" IS NULL)
);

-- CHECK constraints for order_reservation_lines
ALTER TABLE "order_reservation_lines" ADD CONSTRAINT "order_reservation_lines_amount_check" CHECK ("amount" > 0 AND "amount" <> 'NaN'::decimal);
