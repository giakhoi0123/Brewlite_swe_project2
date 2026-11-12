# Payment mock contract — automated tests only

Status: **Superseded for runtime use**.

The current customer-facing contract is [`payments-api.md`](./payments-api.md) and uses only
VNPay Sandbox. `MockPaymentGatewayAdapter` remains in the repository solely to make unit and
PostgreSQL integration tests deterministic without depending on external network availability.

The test adapter can produce `SUCCESS`, `FAILURE`, `PROCESSING`, `TIMEOUT` and `UNKNOWN` outcomes.
It must not be selected by the application outside `NODE_ENV=test`, and the frontend must not
send `X-Mock-Payment-Scenario`.

All test requests use:

```json
{
  "orderId": "10000000-0000-4000-8000-000000000001",
  "method": "VNPAY"
}
```

These deterministic scenarios verify idempotency, concurrency, Payment/Order transitions and
inventory reservation behavior. They do not replace the required manual end-to-end evidence
against VNPay Sandbox.
