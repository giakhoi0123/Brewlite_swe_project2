# Task 5 — Nguyễn Tuấn Kiệt payment acceptance record

Ngày kiểm tra local: 2026-11-10.

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

- Prisma: 9/9 migrations apply thành công; seed tạo lại dữ liệu thành công.
- Unit/service: 19 suites, 309 tests passed.
- PostgreSQL integration: 10 suites, 74 tests passed.
- API E2E chạy tuần tự: 12 suites, 90 tests passed.
- ESLint: passed.
- Nest build: passed.
- Frontend: 17 suites, 128 tests passed; typecheck và Next.js production build passed.

Test trọng tâm nằm tại:

- `apps/api/src/payments/adapters/mock-payment-gateway.adapter.spec.ts`
- `apps/api/src/payments/payments.service.spec.ts`
- `apps/api/test/payments-integration.e2e-spec.ts`

## Ghi chú ranh giới module

Payment không nhận hoặc lưu số thẻ, CVV hay token ví thật. Số tiền luôn đọc từ Order. Inventory
reservation thuộc Orders module. Việc tích hợp transaction-aware với vòng đời reservation của
Orders và cộng điểm qua LoyaltyService của Duy được giữ lại cho bước phối hợp riêng; lần resolve
conflict này không sửa code trong Orders hoặc Loyalty.
