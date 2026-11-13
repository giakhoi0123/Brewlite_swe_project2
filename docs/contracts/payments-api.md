# Payments API contract — VNPay Sandbox

Status: **Implemented**.

This is the source of truth for BrewLite payment creation, VNPay Return/IPN handling and
frontend status polling. The application uses VNPay Sandbox only and never handles real money,
card numbers, CVV values or online-banking credentials.

Traceability: UC-01, FR-03, FR-05, NFR-02, NFR-04 and ADR-004.

## Create a payment

`POST /api/payments`

Required headers:

| Header | Rule |
|---|---|
| `Authorization` | Valid customer Bearer JWT. |
| `Idempotency-Key` | Client-generated UUID v4 for one logical attempt. |

Request body:

```json
{
  "orderId": "10000000-0000-4000-8000-000000000001",
  "method": "VNPAY"
}
```

The backend reads the authoritative amount and owner from the stored Order. A newly accepted
attempt is persisted before the signed VNPay URL is created. The normal response is HTTP 202:

```json
{
  "paymentId": "30000000-0000-4000-8000-000000000001",
  "orderId": "10000000-0000-4000-8000-000000000001",
  "method": "VNPAY",
  "amount": 58000,
  "paymentStatus": "PROCESSING",
  "orderStatus": "PENDING",
  "resultCode": "PAYMENT_PROCESSING",
  "retryable": false,
  "processedAt": null,
  "checkoutUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
  "expiresAt": "2026-11-12T03:15:00.000Z"
}
```

The browser redirects to `checkoutUrl`. VNPay parameters use API version `2.1.0`, VND amount
multiplied by 100, GMT+7 timestamps and HMAC-SHA512 over the alphabetically sorted query.

## Read payment status

`GET /api/payments/:paymentId`

This endpoint requires the owning customer's JWT. It returns the persisted response shape above.
`checkoutUrl` can be null after terminal or legacy attempts. The frontend polls this endpoint
after VNPay redirects the browser back.

## VNPay Return URL

`GET /api/payments/vnpay-return`

This public endpoint validates the VNPay checksum and redirects the browser to
`VNPAY_FRONTEND_RETURN_URL` with `valid`, `responseCode` and, for a known valid transaction,
`paymentId`. It does **not** mark an Order paid. Browser redirects are presentation flow only.

## VNPay IPN URL

`GET /api/payments/vnpay-ipn`

The endpoint validates all of the following before changing state:

- HMAC-SHA512 checksum and configured `vnp_TmnCode`;
- `vnp_TxnRef` mapped to one persisted Payment;
- `vnp_Amount` equal to the server-authoritative Order amount multiplied by 100;
- success requires both `vnp_ResponseCode=00` and `vnp_TransactionStatus=00`.

IPN responses follow the VNPay JSON contract:

| `RspCode` | Meaning |
|---|---|
| `00` | Result recorded successfully. |
| `01` | Transaction reference not found. |
| `02` | Payment was already finalized; no duplicate transition occurs. |
| `04` | Amount does not match. |
| `97` | Invalid checksum or merchant identity. |
| `99` | Internal processing error; VNPay may retry. |

A successful IPN atomically marks Payment and Order `PAID` and consumes the active inventory
reservation. A determinate unsuccessful IPN marks Payment `FAILED`, moves the Order to
`PAYMENT_FAILED` and releases inventory exactly once.

## Idempotency and invariants

- Same key and same payload replay the original persisted response and checkout URL.
- Same key with another order returns 409 `IDEMPOTENCY_KEY_CONFLICT`.
- An Order cannot have two unresolved attempts or two successful payments.
- A failed attempt can be retried with the same Order and a new idempotency key after stock is
  revalidated and reserved again.
- IPN processing is idempotent; a repeated callback cannot consume or release stock twice.
- Return URL data never overrides the persisted payment status.

## Error envelope

Validation, authentication, authorization and conflict errors use:

```json
{
  "statusCode": 409,
  "code": "IDEMPOTENCY_KEY_CONFLICT",
  "message": "Idempotency-Key is already associated with a different payment payload.",
  "retryable": false
}
```

Relevant codes include `INVALID_PAYMENT_REQUEST`, `UNSUPPORTED_PAYMENT_METHOD`,
`AUTHENTICATION_REQUIRED`, `ORDER_ACCESS_DENIED`, `ORDER_NOT_FOUND`, `PAYMENT_NOT_FOUND`,
`IDEMPOTENCY_KEY_CONFLICT`, `ORDER_ALREADY_PAID`, `ORDER_NOT_PAYABLE`,
`PAYMENT_GATEWAY_UNAVAILABLE` and `PAYMENT_INTERNAL_ERROR`.

## Configuration

Server-only environment variables:

- `VNPAY_TMN_CODE`
- `VNPAY_HASH_SECRET`
- `VNPAY_PAYMENT_URL`
- `VNPAY_RETURN_URL`
- `VNPAY_FRONTEND_RETURN_URL`

`VNPAY_IPN_URL` documents the public HTTPS endpoint that must be registered in the VNPay Sandbox
merchant configuration. Secrets must never be exposed through `NEXT_PUBLIC_*`, committed or logged.

The deterministic `MockPaymentGatewayAdapter` and `X-Mock-Payment-Scenario` header are test-only
facilities. They are not part of the browser or production contract.
