# Task 5 — Nguyễn Tuấn Kiệt payment acceptance record

Ngày kiểm tra và đồng bộ gần nhất: 2026-11-14.

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

## Kết quả quality gate (Local & CI PostgreSQL 16)

Chạy từ `apps/api` và `apps/web` (kết hợp container `postgres:16-alpine` cô lập):

```powershell
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:integration
npm.cmd run test:e2e -- --runInBand
npm.cmd run build
```

Kết quả đã xác minh:

- **Prisma schema & migrations:** Toàn bộ 14 migrations (bao gồm `20261111160000_harden_payment_attempts`, `20261112103000_add_vnpay_sandbox`, `20261112144000_backfill_vnpay_transaction_date`, `20261113030000_rename_loyalty_log_to_loyalty_transaction`) và deterministic seed đã chạy thành công trên PostgreSQL 16.
- **Unit/service backend:** 20 suites, 310 tests passed; ESLint và NestJS production build passed.
- **PostgreSQL Payment integration (`payments-integration.e2e-spec.ts`):** PASS trên PostgreSQL 16 cô lập — xác nhận thiếu JWT trả `401 AUTHENTICATION_REQUIRED` trước khi gọi gateway; concurrent same-key chỉ tạo 1 row Payment và gọi gateway đúng 1 lần; `PAID` consume reservation (`ACTIVE -> CONSUMED`); `FAILED` hoàn stock đúng 1 lần (`ACTIVE -> RELEASED`); retry với key mới tái giữ kho (`RELEASED -> ACTIVE`) và chuyển `PAYMENT_FAILED -> PENDING -> PAID`; `TIMEOUT` giữ reservation `ACTIVE` và chặn key khác bằng `409 ORDER_NOT_PAYABLE`.
- **Frontend:** 19 suites, 139 tests passed; ESLint, TypeScript typecheck (`tsc --noEmit`) và Next.js production build passed.
- **Minh chứng GitHub Actions CI (PostgreSQL 16 service container):**
  - PR [#41](https://github.com/giakhoi0123/Brewlite_swe_project2/pull/41) (`feature/task5-kiet-payment-completion`, commit `8d4713f`): [CI Run #63](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43445487051) — PASS cả 4 jobs (`Preflight Inspection`, `Backend Quality Gate` [job 131953885126](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43445487051/job/131953885126) gồm migrate/seed/integration, `Frontend Quality Gate`, `Quality Gate Summary`).
  - Merge vào `main` (commit `ee0dc60`): [CI Run #64](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43447327273) — PASS.
  - Nhánh `main` hiện hành (commit `d14371f`): [CI Run #70](https://github.com/giakhoi0123/Brewlite_swe_project2/actions/runs/43575888226) — PASS.

Test trọng tâm nằm tại:

- `apps/api/src/payments/adapters/vnpay-payment-gateway.adapter.spec.ts`
- `apps/api/src/payments/adapters/mock-payment-gateway.adapter.spec.ts` (test-only)
- `apps/api/src/payments/payments.service.spec.ts`
- `apps/api/test/payments-integration.e2e-spec.ts`
- `apps/web/src/app/checkout/__tests__/CheckoutPage.test.tsx`
- `apps/web/src/services/__tests__/checkout-api.test.ts`

## Ghi chú ranh giới module

Payment không nhận hoặc lưu số thẻ, CVV hay thông tin ngân hàng. Số tiền luôn đọc từ Order. Inventory
reservation thuộc Orders module và đã được nối qua transaction-aware boundary:

- Transaction A commit `Payment=PROCESSING` trước khi gọi gateway.
- Gateway chạy ngoài database transaction.
- Transaction B cập nhật Payment cùng Order/Reservation/stock/version/history.
- FAILED hoàn kho và chuyển Reservation `ACTIVE -> RELEASED`; retry cùng Order dùng key mới,
  kiểm tra lại stock và chuyển `RELEASED -> ACTIVE` trước khi gọi gateway.
