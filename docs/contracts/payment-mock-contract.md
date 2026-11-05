# Payment mock contract — Sprint 2 preparation

> Historical preparation artifact. The accepted Task 5 implementation contract is
> [`payments-api.md`](./payments-api.md). Future contract changes must be made there.

Status: **Accepted for the Sprint 2 mock contract**. This contract prepares deterministic
development and test fixtures only. It does not implement a Payment module, database schema
or real gateway.

Traceability: UC-01, FR-03, FR-05, NFR-02, NFR-04 and ADR-004.

## Endpoint and authentication

`POST /api/payments` (`/payments` is the controller resource path; `/api` is the current
NestJS global prefix).

Required headers:

| Header | Contract |
|---|---|
| `Authorization` | `Bearer <JWT>`. The backend verifies authentication and order ownership. |
| `Idempotency-Key` | A client-generated UUID. It identifies one logical payment attempt. |
| `Content-Type` | `application/json`. |
| `X-Mock-Payment-Scenario` | Optional in development/test only: `SUCCESS`, `FAILURE`, `PROCESSING`, `TIMEOUT` or `UNKNOWN`. The adapter reads it only for the first request associated with a new idempotency key. It must be disabled in production. |

Request body:

```json
{
  "orderId": "10000000-0000-4000-8000-000000000001",
  "method": "WALLET"
}
```

`method` is either `WALLET` or `CARD`. The client must not send an amount or order status;
the backend reads the authoritative amount and state from the order.

## Successful and non-terminal responses

The response shape is stable across payment outcomes:

```json
{
  "paymentId": "30000000-0000-4000-8000-000000000001",
  "orderId": "10000000-0000-4000-8000-000000000001",
  "method": "WALLET",
  "amount": 58000,
  "paymentStatus": "PAID",
  "orderStatus": "PAID",
  "resultCode": "PAYMENT_PAID",
  "retryable": false,
  "processedAt": "2026-11-01T08:00:00.000Z"
}
```

| Scenario | HTTP | `paymentStatus` | `orderStatus` | `resultCode` | Client rule |
|---|---:|---|---|---|---|
| `SUCCESS` | 200 | `PAID` | `PAID` | `PAYMENT_PAID` | Clear the cart and show the order confirmation. |
| `PROCESSING` | 202 | `PROCESSING` | `PENDING` | `PAYMENT_PROCESSING` | Show a verifying state; do not create another payment attempt. |
| `TIMEOUT` | 202 | `UNKNOWN` | `PENDING` | `PAYMENT_STATUS_UNKNOWN` | Keep the order pending for reconciliation; do not retry with a new key automatically. |
| `UNKNOWN` | 202 | `UNKNOWN` | `PENDING` | `PAYMENT_STATUS_UNKNOWN` | Same handling as timeout. |

For `PROCESSING` and `UNKNOWN`, `processedAt` is `null`.

## Determinate failure response

A mock gateway decline is a stored payment result:

```json
{
  "paymentId": "30000000-0000-4000-8000-000000000002",
  "orderId": "10000000-0000-4000-8000-000000000001",
  "method": "CARD",
  "amount": 58000,
  "paymentStatus": "FAILED",
  "orderStatus": "PAYMENT_FAILED",
  "resultCode": "PAYMENT_DECLINED",
  "retryable": true,
  "processedAt": "2026-11-01T08:01:00.000Z"
}
```

The HTTP status is `402 Payment Required`. Inventory is released exactly once. Retrying this
failure uses the same `orderId` and a **new** `Idempotency-Key`; the order/inventory flow must
revalidate and reserve stock before creating the next Payment.

## Idempotency rules

The backend stores a fingerprint of `orderId` and `method` with the key before invoking the
mock adapter.

| Request | Result |
|---|---|
| Same key and same payload after `PAID` | Return the original 200 response. Do not create a Payment or invoke the adapter again. |
| Same key and same payload after `FAILED` | Return the original 402 response. A new attempt requires a new key. |
| Same key and same payload while `PROCESSING`/`UNKNOWN` | Return the stored 202 response. Do not create another transaction. |
| Same key with a different `orderId` or `method` | Return 409 `IDEMPOTENCY_KEY_CONFLICT`. Do not invoke the adapter. |
| New key for an order already `PAID` | Return 409 `ORDER_ALREADY_PAID`. Do not create a Payment or invoke the adapter. |
| New key after `PAYMENT_FAILED` | Allowed only after order/inventory revalidation; it represents a new Payment attempt. |

Changing `X-Mock-Payment-Scenario` does not change the idempotency fingerprint. A replay uses
the stored result from the first request.

## Error envelope

```json
{
  "statusCode": 409,
  "code": "IDEMPOTENCY_KEY_CONFLICT",
  "message": "Idempotency-Key is already associated with a different payment payload.",
  "retryable": false
}
```

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `INVALID_PAYMENT_REQUEST` | Missing/invalid `orderId`, key or JSON payload. |
| 400 | `UNSUPPORTED_PAYMENT_METHOD` | Method is not `WALLET` or `CARD`. |
| 401 | `AUTHENTICATION_REQUIRED` | JWT is missing, invalid or expired. |
| 403 | `ORDER_ACCESS_DENIED` | The authenticated customer does not own the order. |
| 404 | `ORDER_NOT_FOUND` | No order exists for `orderId`. |
| 409 | `IDEMPOTENCY_KEY_CONFLICT` | The key exists with a different request fingerprint. |
| 409 | `ORDER_ALREADY_PAID` | A new payment attempt was submitted for a paid order. |
| 409 | `ORDER_NOT_PAYABLE` | The order state or inventory revalidation does not allow payment. |
| 402 | `PAYMENT_DECLINED` | The mock adapter returned a determinate failure; the stored Payment is `FAILED`. |
| 500 | `PAYMENT_INTERNAL_ERROR` | Persistence/transaction failed. Replay the same key before considering a new attempt. |

## State transition summary

| Event | Payment | Order |
|---|---|---|
| New accepted attempt | `PROCESSING` | `PENDING` |
| Success | `PAID` | `PAID` |
| Determinate failure | `FAILED` | `PAYMENT_FAILED` |
| Timeout/unresolved result | `UNKNOWN` | `PENDING` |

No response may move an order from `PAID` back to `PENDING` or create a second successful
Payment for the same order.

## Confirmed determinate-failure status

A determinate payment failure uses HTTP `402 Payment Required` with the
`PAYMENT_DECLINED` code. The sequence diagram, this contract and the fixtures use the same
decision.

The TypeScript types and deterministic examples are stored in
`apps/api/test/fixtures/payment-mock-contract.fixture.ts`.
