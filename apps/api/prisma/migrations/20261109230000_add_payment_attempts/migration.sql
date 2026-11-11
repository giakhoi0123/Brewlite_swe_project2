-- Extend the order lifecycle with payment-facing states.
ALTER TYPE "OrderStatus" ADD VALUE 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_FAILED';

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PROCESSING', 'PAID', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PaymentResultCode" AS ENUM (
    'PAYMENT_PAID',
    'PAYMENT_DECLINED',
    'PAYMENT_PROCESSING',
    'PAYMENT_STATUS_UNKNOWN'
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PROCESSING',
    "result_code" "PaymentResultCode" NOT NULL DEFAULT 'PAYMENT_PROCESSING',
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "http_status" INTEGER NOT NULL DEFAULT 202,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Idempotency-Key is the database-level concurrency guard for one logical attempt.
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- An order may have multiple failed attempts but at most one successful payment.
CREATE UNIQUE INDEX "payments_one_paid_per_order_key"
ON "payments"("order_id")
WHERE "status" = 'PAID';

-- AddForeignKey
ALTER TABLE "payments"
ADD CONSTRAINT "payments_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
