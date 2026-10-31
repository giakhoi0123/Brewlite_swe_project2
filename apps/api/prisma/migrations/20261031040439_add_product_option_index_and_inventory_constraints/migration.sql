-- CreateIndex
CREATE INDEX "product_options_product_id_idx" ON "product_options"("product_id");

-- AddCheckConstraints
ALTER TABLE "products"
ADD CONSTRAINT "products_base_price_non_negative"
CHECK ("base_price" >= 0);

ALTER TABLE "product_options"
ADD CONSTRAINT "product_options_extra_price_non_negative"
CHECK ("extra_price" >= 0);

ALTER TABLE "inventories"
ADD CONSTRAINT "inventories_quantity_non_negative"
CHECK ("quantity" >= 0);

ALTER TABLE "inventories"
ADD CONSTRAINT "inventories_reserved_non_negative"
CHECK ("reserved" >= 0);

ALTER TABLE "inventories"
ADD CONSTRAINT "inventories_reserved_lte_quantity"
CHECK ("reserved" <= "quantity");
