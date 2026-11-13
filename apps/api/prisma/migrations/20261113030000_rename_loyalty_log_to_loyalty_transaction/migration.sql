-- RenameTable
ALTER TABLE "loyalty_logs" RENAME TO "loyalty_transactions";

-- RenameConstraint
ALTER TABLE "loyalty_transactions" RENAME CONSTRAINT "loyalty_logs_pkey" TO "loyalty_transactions_pkey";
ALTER TABLE "loyalty_transactions" RENAME CONSTRAINT "loyalty_logs_user_id_fkey" TO "loyalty_transactions_user_id_fkey";
ALTER TABLE "loyalty_transactions" RENAME CONSTRAINT "loyalty_logs_order_id_fkey" TO "loyalty_transactions_order_id_fkey";

-- RenameIndex
ALTER INDEX "loyalty_logs_user_id_idx" RENAME TO "loyalty_transactions_user_id_idx";
ALTER INDEX "loyalty_logs_order_id_idx" RENAME TO "loyalty_transactions_order_id_idx";
ALTER INDEX "loyalty_logs_order_id_type_key" RENAME TO "loyalty_transactions_order_id_type_key";