ALTER TABLE "payments"
ADD COLUMN "provider_txn_date" VARCHAR(14);

UPDATE "payments"
SET "provider_txn_date" = substring("checkout_url" FROM 'vnp_CreateDate=([0-9]{14})')
WHERE "provider_txn_date" IS NULL
  AND "checkout_url" IS NOT NULL
  AND "checkout_url" ~ '(^|[?&])vnp_CreateDate=[0-9]{14}(&|$)';
