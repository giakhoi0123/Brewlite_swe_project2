-- Only one unresolved attempt may exist for an order. This is the database-level
-- guard against concurrent requests that use different Idempotency-Key values.
CREATE UNIQUE INDEX "payments_one_unresolved_per_order_key"
ON "payments"("order_id")
WHERE "status" IN ('PROCESSING', 'UNKNOWN');

-- Payment snapshots and persisted HTTP outcomes must remain internally valid.
ALTER TABLE "payments"
ADD CONSTRAINT "payments_amount_nonnegative_check"
CHECK ("amount" >= 0 AND "amount" <> 'NaN'::decimal);

ALTER TABLE "payments"
ADD CONSTRAINT "payments_http_status_check"
CHECK ("http_status" IN (200, 202, 402));

ALTER TABLE "payments"
ADD CONSTRAINT "payments_outcome_consistency_check"
CHECK (
  ("status" = 'PROCESSING' AND "result_code" = 'PAYMENT_PROCESSING' AND "http_status" = 202 AND "retryable" = false AND "processed_at" IS NULL) OR
  ("status" = 'UNKNOWN' AND "result_code" = 'PAYMENT_STATUS_UNKNOWN' AND "http_status" = 202 AND "retryable" = false AND "processed_at" IS NULL) OR
  ("status" = 'PAID' AND "result_code" = 'PAYMENT_PAID' AND "http_status" = 200 AND "retryable" = false AND "processed_at" IS NOT NULL) OR
  ("status" = 'FAILED' AND "result_code" = 'PAYMENT_DECLINED' AND "http_status" = 402 AND "retryable" = true AND "processed_at" IS NOT NULL)
);
