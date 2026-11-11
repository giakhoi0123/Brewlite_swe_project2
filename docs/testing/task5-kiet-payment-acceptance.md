# Task 5 — Nguyễn Tuấn Kiệt payment acceptance record

Ngày kiểm tra local gần nhất: 2026-11-12.

## Phạm vi theo Assignment

| Yêu cầu Task 5 của Kiệt | Minh chứng |
|---|---|
| Mock Payment Ví/Thẻ | `MockPaymentGatewayAdapter` hỗ trợ cả `WALLET` và `CARD`. |
| Success/failure/processing/timeout/unknown | Unit test adapter và API mapping sang HTTP `200`, `402`, `202`. |
| Idempotency | Unique `payments.idempotency_key`, request fingerprint và replay response đã lưu. |
| Không ghi nhận trùng | PostgreSQL integration test gửi hai request đồng thời, kiểm tra một row Payment, cùng `paymentId` và gateway chỉ được gọi một lần. |
| Retry sau decline | Service và integration test xác nhận key mới tạo attempt mới, chuyển `PAYMENT_FAILED` sang `PAID`. |
| Chặn thanh toán trùng | Partial unique index chỉ cho tối đa một Payment `PAID` trên mỗi order; key mới trên order đã trả tiền nhận `ORDER_ALREADY_PAID`. |
| JWT và ownership | Endpoint có payment-specific JWT error contract và kiểm tra chủ sở hữu order trước khi gọi gateway. |

## Kết quả quality gate local

Chạy từ `apps/api` với PostgreSQL test riêng `brewlite_test`:

```powershell
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:integration
npm.cmd run test:e2e -- --runInBand
npm.cmd run build
```

Kết quả:

- Prisma: 11/11 migrations apply thành công trên PostgreSQL 16 hoàn toàn sạch.
- Unit/service backend: 19 suites, 311 tests passed; lint và Nest build passed.
- PostgreSQL Payment integration: 1 suite, 4 tests passed trên database cô lập.
- Payment integration xác nhận concurrent same-key chỉ gọi gateway một lần; PAID consume
  reservation; FAILED hoàn stock đúng một lần; retry tái giữ kho; TIMEOUT giữ reservation ACTIVE.
- ESLint: passed.
- Frontend: 19 suites, 138 tests passed; typecheck và Next.js production build passed.

Test trọng tâm nằm tại:

- `apps/api/src/payments/adapters/mock-payment-gateway.adapter.spec.ts`
- `apps/api/src/payments/payments.service.spec.ts`
- `apps/api/test/payments-integration.e2e-spec.ts`

## Ghi chú ranh giới module

Payment không nhận hoặc lưu số thẻ, CVV hay token ví thật. Số tiền luôn đọc từ Order. Inventory
reservation thuộc Orders module và đã được nối qua transaction-aware boundary:

- Transaction A commit `Payment=PROCESSING` trước khi gọi gateway.
- Gateway chạy ngoài database transaction.
- Transaction B cập nhật Payment cùng Order/Reservation/stock/version/history.
- FAILED hoàn kho và chuyển Reservation `ACTIVE -> RELEASED`; retry cùng Order dùng key mới,
  kiểm tra lại stock và chuyển `RELEASED -> ACTIVE` trước khi gọi gateway.
