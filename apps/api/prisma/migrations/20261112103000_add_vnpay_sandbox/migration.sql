-- VNPay is the sole payment method. Existing development-only mock attempts
-- are normalized before replacing the legacy WALLET/CARD enum.
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_legacy";
CREATE TYPE "PaymentMethod" AS ENUM ('VNPAY');

ALTER TABLE "payments"
ALTER COLUMN "method" TYPE "PaymentMethod"
USING ('VNPAY'::"PaymentMethod");

DROP TYPE "PaymentMethod_legacy";

ALTER TABLE "payments"
ADD COLUMN "provider_txn_ref" VARCHAR(100),
ADD COLUMN "gateway_txn_no" VARCHAR(255),
ADD COLUMN "checkout_url" TEXT,
ADD COLUMN "expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "payments_provider_txn_ref_key"
ON "payments"("provider_txn_ref");
