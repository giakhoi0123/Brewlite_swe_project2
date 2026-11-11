/*
  Warnings:

  - A unique constraint covering the columns `[order_id,type]` on the table `loyalty_logs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LoyaltyType" AS ENUM ('EARN', 'REDEEM', 'REVERSE');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "loyalty_logs" ADD COLUMN     "amount" DECIMAL(10,2),
ADD COLUMN     "order_id" UUID,
ADD COLUMN     "type" "LoyaltyType" NOT NULL DEFAULT 'EARN';

-- CreateIndex
CREATE INDEX "loyalty_logs_order_id_idx" ON "loyalty_logs"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_logs_order_id_type_key" ON "loyalty_logs"("order_id", "type");

-- AddForeignKey
ALTER TABLE "loyalty_logs" ADD CONSTRAINT "loyalty_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
