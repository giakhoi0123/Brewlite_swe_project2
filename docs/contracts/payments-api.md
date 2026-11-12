# Payments API contract — Task 5.1

Status: **Implemented and verified for Sprint 2**.

This contract defines the implemented simulated Wallet/Card payment boundary. It is the source
of truth for the API implementation, frontend integration and payment tests.

Traceability: UC-01, FR-03, FR-05, NFR-02, NFR-04 and ADR-004.

The Payments service reads the authoritative total, customer ownership and payable state from
the persisted Order. Inventory reservation remains owned by the Orders flow. Payments delegates
every PAID/FAILED/retry transition to the transaction-aware Orders lifecycle so Payment, Order,
Reservation, stock, Order version and status history are updated atomically.

## Endpoint and authentication

`POST /api/payments`

`/payments` is the controller resource path; `/api` is the current NestJS global prefix.

Required headers:

| Header | Contract |
|---|---|
| `Authorization` | `Bearer <JWT>`. The backend verifies authentication and order ownership. |
| `Idempotency-Key` | A client-generated UUID identifying one logical payment attempt. |
| `Content-Type` | `application/json`. |
| `X-Mock-Payment-Scenario` | Optional in development/test only: `SUCCESS`, `FAILURE`, `PROCESSING`, `TIMEOUT` or `UNKNOWN`. It is read only for the first request associated with a new idempotency key and must be ignored or rejected in production. |

Request body:

```json
{
  "orderId": "10000000-0000-4000-8000-000000000001",
  "method": "WALLET"
}
```

| Field | Validation |
|---|---|
| `orderId` | Required UUID referencing an existing order owned by the authenticated customer. |
| `method` | Required enum: `WALLET` or `CARD`. |

The client must not send an amount, payment status or order status. The backend reads the
authoritative amount and state from the order. The current global validation policy strips
unknown request fields; DTO validation still rejects missing or invalid required fields.

## Payment response

Every accepted payment attempt returns the following shape, including determinate gateway
declines:

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

| Field | JSON type | Meaning |
|---|---|---|
| `paymentId` | string | UUID of the persisted payment attempt. |
| `orderId` | string | UUID of the order being paid. |
| `method` | string | `WALLET` or `CARD`. |
| `amount` | number | Authoritative order total captured by the backend. |
| `paymentStatus` | string | `PROCESSING`, `PAID`, `FAILED` or `UNKNOWN`. |
| `orderStatus` | string | Payment-facing order state: `PENDING`, `PAID` or `PAYMENT_FAILED`. |
| `resultCode` | string | Stable machine-readable payment result. |
| `retryable` | boolean | Whether a user-initiated new attempt is allowed. It never authorizes an automatic duplicate charge. |
| `processedAt` | string or null | ISO-8601 completion time, or `null` for non-terminal/unresolved results. |

### Outcome matrix

| Scenario | HTTP | `paymentStatus` | `orderStatus` | `resultCode` | `retryable` | Client rule |
|---|---:|---|---|---|---:|---|
| `SUCCESS` | 200 | `PAID` | `PAID` | `PAYMENT_PAID` | false | Clear the cart and show order confirmation. |
| `FAILURE` | 402 | `FAILED` | `PAYMENT_FAILED` | `PAYMENT_DECLINED` | true | Keep the cart/order context and allow an explicit new attempt with a new key. |
| `PROCESSING` | 202 | `PROCESSING` | `PENDING` | `PAYMENT_PROCESSING` | false | Show a verifying state; do not create another attempt. |
| `TIMEOUT` | 202 | `UNKNOWN` | `PENDING` | `PAYMENT_STATUS_UNKNOWN` | false | Keep the order pending for reconciliation; do not automatically retry. |
| `UNKNOWN` | 202 | `UNKNOWN` | `PENDING` | `PAYMENT_STATUS_UNKNOWN` | false | Use the same handling as timeout. |

`FAILURE` is a stored payment result, not an error-envelope response. Its HTTP status is
`402 Payment Required`, its `processedAt` is populated, and inventory is released exactly once.
Retrying a determinate failure uses the same `orderId` and a **new** `Idempotency-Key` after
the order/inventory flow revalidates and reserves stock.

For `PROCESSING`, `TIMEOUT` and `UNKNOWN`, `processedAt` is `null`.

## Idempotency and retry rules

Before invoking the mock adapter, transaction A reserves the idempotency key, stores a
fingerprint of the normalized `orderId` and `method`, persists `Payment=PROCESSING`, and commits.
The gateway is called only after this commit. Transaction B then applies the gateway result with
the complete Orders inventory lifecycle. Database uniqueness is the final guard against
concurrent duplicate requests, including different keys racing for one unresolved Order.

| Request | Required result |
|---|---|
| Same key and same payload after `PAID` | Replay the original HTTP 200 response. Do not create another Payment or invoke the adapter. |
| Same key and same payload after `FAILED` | Replay the original HTTP 402 response. A new attempt requires a new key. |
| Same key and same payload while `PROCESSING`/`UNKNOWN` | Replay the stored HTTP 202 response. Do not create another transaction. |
| Concurrent requests with the same key and payload | Resolve to the same persisted `paymentId`; exactly one Payment row and one adapter invocation are allowed. |
| Same key with a different `orderId` or `method` | Return 409 `IDEMPOTENCY_KEY_CONFLICT`; do not invoke the adapter. |
| New key for an order already `PAID` | Return 409 `ORDER_ALREADY_PAID`; do not create a Payment or invoke the adapter. |
| New key after `PAYMENT_FAILED` | Allowed only after order/inventory revalidation; it represents a new Payment attempt. |
| Network failure before the client receives a response | Retry the same request with the same key. Do not generate a new key merely because the response was lost. |

Changing `X-Mock-Payment-Scenario` does not change the fingerprint. A replay always uses the
stored HTTP status and body produced by the first request.

## Error envelope

Validation, authentication, authorization, lookup, conflict and internal failures use:

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
| 400 | `INVALID_PAYMENT_REQUEST` | Missing/invalid `orderId`, idempotency key or JSON payload. |
| 400 | `UNSUPPORTED_PAYMENT_METHOD` | Method is not `WALLET` or `CARD`. |
| 401 | `AUTHENTICATION_REQUIRED` | JWT is missing, invalid or expired. |
| 403 | `ORDER_ACCESS_DENIED` | The authenticated customer does not own the order. |
| 404 | `ORDER_NOT_FOUND` | No order exists for `orderId`. |
| 409 | `IDEMPOTENCY_KEY_CONFLICT` | The key exists with a different request fingerprint. |
| 409 | `ORDER_ALREADY_PAID` | A new payment attempt was submitted for a paid order. |
| 409 | `ORDER_NOT_PAYABLE` | The order state or inventory revalidation does not allow payment. |
| 500 | `PAYMENT_INTERNAL_ERROR` | Persistence/transaction failed. The client may retry the same payload with the same key. |

HTTP 402 `PAYMENT_DECLINED` deliberately does not use this envelope; it returns the persisted
Payment response described in the outcome matrix.

## State transitions and invariants

| Event | Payment | Order | Inventory reservation |
|---|---|---|---|
| New accepted attempt | `PROCESSING` | `PENDING` | Existing `ACTIVE` reservation remains held |
| Success | `PAID` | `PAID` | `ACTIVE -> CONSUMED`; stock is not deducted again |
| Determinate failure | `FAILED` | `PAYMENT_FAILED` | Stock restored once; `ACTIVE -> RELEASED` |
| Explicit retry after failure | New `PROCESSING` attempt | `PAYMENT_FAILED -> PENDING` | Stock revalidated/deducted; `RELEASED -> ACTIVE` |
| Timeout/unresolved result | `UNKNOWN` | `PENDING` | Remains `ACTIVE` for reconciliation |

The implementation must preserve these invariants:

- An order cannot move from `PAID` back to `PENDING` or `PAYMENT_FAILED`.
- At most one successful Payment may exist for an order.
- At most one `PROCESSING`/`UNKNOWN` Payment may exist for an order.
- Replaying a key cannot change its method, order, HTTP status or stored body.
- The mock scenario header cannot bypass authentication, ownership or payable-state checks.
- No secret, raw card data or wallet credential is accepted or persisted by this mock API.

## Mock configuration and production boundary

The mock adapter supports deterministic development and test behavior only. Production must
not allow callers to choose a scenario with `X-Mock-Payment-Scenario`. The eventual adapter
selection is configuration-driven and remains behind the payment port from ADR-004.

This assignment mock never accepts a card number, CVV, wallet token or other real payment
credential. `CARD` and `WALLET` are simulated method identifiers only.

## Compatibility and verification

The frontend already calls `POST /api/payments`, sends JWT and `Idempotency-Key`, and limits
the mock scenario header to non-production builds. The backend implementation must conform to
this document rather than introducing a second response shape.

The API CORS allowlist includes `Idempotency-Key` for the browser client and includes
`X-Mock-Payment-Scenario` only outside production. Production ignores caller-controlled mock
outcomes and does not expose the mock scenario header through CORS.

Deterministic examples and expected status codes are stored in
`apps/api/test/fixtures/payment-mock-contract.fixture.ts`.

Required verification for Task 5:

- Unit tests for Wallet/Card and every mock scenario.
- Service tests for replay, key conflict, paid-order rejection and retry after failure.
- PostgreSQL integration tests proving concurrent duplicate requests create one Payment row
  and return the same `paymentId`.
- CI execution through the backend quality gate after the Payments module is implemented.

Verified API commands from `apps/api`:

```powershell
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:integration
npm.cmd run build
```
