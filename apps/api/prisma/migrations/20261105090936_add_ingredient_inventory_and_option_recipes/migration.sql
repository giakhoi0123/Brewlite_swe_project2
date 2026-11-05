-- CreateEnum
CREATE TYPE "IngredientUnit" AS ENUM ('G', 'ML', 'PIECE');

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "unit" "IngredientUnit" NOT NULL,
    "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_recipes" (
    "product_option_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "option_recipes_pkey" PRIMARY KEY ("product_option_id","ingredient_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE INDEX "option_recipes_ingredient_id_idx" ON "option_recipes"("ingredient_id");

-- AddForeignKey
ALTER TABLE "option_recipes" ADD CONSTRAINT "option_recipes_product_option_id_fkey" FOREIGN KEY ("product_option_id") REFERENCES "product_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_recipes" ADD CONSTRAINT "option_recipes_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraints
ALTER TABLE "ingredients"
ADD CONSTRAINT "ingredients_name_not_blank"
CHECK (btrim("name") <> '');

ALTER TABLE "ingredients"
ADD CONSTRAINT "ingredients_stock_non_negative"
CHECK ("stock" >= 0 AND "stock" <> 'NaN'::numeric);

ALTER TABLE "ingredients"
ADD CONSTRAINT "ingredients_version_positive"
CHECK ("version" >= 1);

ALTER TABLE "option_recipes"
ADD CONSTRAINT "option_recipes_amount_positive"
CHECK ("amount" > 0 AND "amount" <> 'NaN'::numeric);
