# Task 5 — Nguyễn Tuấn Kiệt payment acceptance record

Ngày kiểm tra local gần nhất: 2026-11-12.

## Phạm vi theo Assignment

| Yêu cầu Task 5 của Kiệt | Minh chứng |
|---|---|
| VNPay Sandbox | `VnpayPaymentGatewayAdapter` tạo URL v2.1.0, nhân số tiền với 100 và ký HMAC-SHA512. |
| Return/IPN | Return chỉ chuyển về UI; IPN xác thực checksum, mã giao dịch và số tiền trước khi cập nhật dữ liệu. |
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

- Prisma schema hợp lệ; migration VNPay mới đã được sinh nhưng chưa chạy lại trên PostgreSQL local
  trong lần cập nhật này vì Docker daemon không hoạt động.
- Unit/service backend: 20 suites, 312 tests passed; lint và Nest build passed.
- PostgreSQL Payment integration trước đó: 1 suite, 4 tests passed trên database cô lập; cần chạy
  lại sau khi bật Docker để áp dụng migration VNPay.
- Payment integration xác nhận concurrent same-key chỉ gọi gateway một lần; PAID consume
  reservation; FAILED hoàn stock đúng một lần; retry tái giữ kho; TIMEOUT giữ reservation ACTIVE.
- ESLint: passed.
- Frontend: 19 suites, 139 tests passed; typecheck và Next.js production build passed.

Test trọng tâm nằm tại:

- `apps/api/src/payments/adapters/vnpay-payment-gateway.adapter.spec.ts`
- `apps/api/src/payments/adapters/mock-payment-gateway.adapter.spec.ts` (test-only)
- `apps/api/src/payments/payments.service.spec.ts`
- `apps/api/test/payments-integration.e2e-spec.ts`

## Ghi chú ranh giới module

Payment không nhận hoặc lưu số thẻ, CVV hay thông tin ngân hàng. Số tiền luôn đọc từ Order. Inventory
reservation thuộc Orders module và đã được nối qua transaction-aware boundary:

- Transaction A commit `Payment=PROCESSING` trước khi gọi gateway.
- Gateway chạy ngoài database transaction.
- Transaction B cập nhật Payment cùng Order/Reservation/stock/version/history.
- FAILED hoàn kho và chuyển Reservation `ACTIVE -> RELEASED`; retry cùng Order dùng key mới,
  kiểm tra lại stock và chuyển `RELEASED -> ACTIVE` trước khi gọi gateway.
