# Báo Cáo Kiểm Thử Chức Năng & Hiệu Năng API — BrewLite (Bài 2)

- **Ngày thực hiện:** 2026-11-17
- **Môi trường đo thực tế:**
  - Backend: NestJS compiled production build (`apps/api/dist/main.js`, `NODE_ENV=production`) lắng nghe tại `http://localhost:3005/api`
  - Database: PostgreSQL 16 (`brewlite-postgres`, host port `5433`, container `5432`) — cô lập hoàn toàn với các dự án khác
  - Frontend (smoke check): Next.js (`brewlite-web`) tại `http://localhost:3006`
  - Công cụ kiểm thử: `ajv-draft-04` (Postman v2.1.0 JSON Schema), Node `vm.Script`, `newman`, và Node concurrent load runner (`fetch`)

---

## 1. Xác thực Schema Postman v2.1.0 & Cú pháp Script

Tất cả 7 file collection trong `docs/testing/` đã được chuẩn hóa (`info.schema`, `variable[].type = "string"`, `item[].response = []`, `request.body.options.raw.language = "json"`) và kiểm tra bằng `ajv-draft-04` theo schema chính thức `https://schema.getpostman.com/json/collection/v2.1.0/collection.json` cùng `vm.Script`:

| File Collection | Số Request | Số Script (`prerequest` + `test`) | Schema v2.1.0 & `vm.Script` |
| :--- | :---: | :---: | :---: |
| `brewlite-auth-postman.collection.json` (Khôi) | 14 | 15 | PASS |
| `brewlite-products-postman.collection.json` (Đông) | 10 | 10 | PASS |
| `brewlite-orders-barista-postman.collection.json` (Điệp) | 17 | 19 | PASS |
| `brewlite-payments-postman.collection.json` (Kiệt) | 21 | 29 | PASS |
| `brewlite-history-promo-loyalty-postman.collection.json` (Duy) | 18 | 19 | PASS |
| `brewlite-deploy-smoke-postman.collection.json` (Trí) | 8 | 8 | PASS |
| `performance-postman.collection.json` (Happy Path) | 13 | 13 | PASS |

---

## 2. Kết quả Kiểm thử Chức năng (Newman CLI)

| Collection | Requests | Assertions (Pass / Total) | Thời gian chạy | Avg / Min / Max | Trạng thái & Ghi chú |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `brewlite-auth-postman.collection.json` | 14 | 19 / 19 | 578 ms | 30 / 1 / 108 ms | **PASS** |
| `brewlite-products-postman.collection.json` | 10 | 16 / 16 | 175 ms | 6 / 1 / 26 ms | **PASS** |
| `brewlite-history-promo-loyalty-postman.collection.json` | 18 | 24 / 24 | 384 ms | 10 / 2 / 58 ms | **PASS** |
| `brewlite-orders-barista-postman.collection.json` | 17 | 17 / 25 | 401 ms | 12 / 1 / 59 ms | **BLOCKED (8 failed)** ở helper VNPay + 4 bước Barista nối tiếp do `.env` thiếu credential VNPay Sandbox |
| `brewlite-payments-postman.collection.json` | 21 | 20 / 30 (2 script lỗi phụ thuộc) | 457 ms | 9 / 1 / 60 ms | **BLOCKED** ở các bước `POST /api/payments` (`503 PAYMENT_GATEWAY_UNAVAILABLE`) do thiếu credential VNPay Sandbox |
| `brewlite-deploy-smoke-postman.collection.json` | 8 | 9 / 10 | 247 ms | 18 / 2 / 55 ms | **BLOCKED (1 failed)** ở `08. ST-05 Payment Gateway` (`503`) do thiếu credential VNPay Sandbox; `01..07` PASS |

### Blocker đã ghi nhận
- **Thiếu credential VNPay Sandbox trong `.env` local:** `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` chưa được cấu hình trong `.env`, nên `VnpayPaymentGatewayAdapter.assertReady()` chủ động từ chối khởi tạo giao dịch và trả `HTTP 503 Service Unavailable` (`PAYMENT_GATEWAY_UNAVAILABLE`). Các endpoint không phụ thuộc cấu hình VNPay (`400` thiếu `Idempotency-Key`, `400` sai `method`, `vnpay-ipn` `RspCode: 97`, `vnpay-return` `302`) vẫn hoạt động bình thường.

---

## 3. Kết quả Kiểm thử Hiệu năng bằng Newman (`performance-postman.collection.json`, 15 vòng lặp)

- **Tổng số vòng lặp:** `15 iterations`
- **Tổng số request:** `195 requests` (13 endpoint happy-path x 15)
- **Assertions:** **`390 / 390 PASS` (0 failed, 0% error rate)** — tất cả đều đạt `< 500 ms`
- **Tổng thời gian chạy:** `4.3 s` | **Trung bình chung:** `13 ms` (`min: 1 ms`, `max: 74 ms`, `s.d.: 19 ms`)

| Request (Happy Path) | n | Min (ms) | Avg (ms) | p95 (ms) | Max (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `01. Auth - Login Customer (200)` | 15 | 53 | 55.1 | 74 | 74 |
| `02. Menu - Get Products Catalog (200)` | 15 | 4 | 7.2 | 15 | 15 |
| `03. Menu - Search Products (200)` | 15 | 3 | 4.3 | 8 | 8 |
| `04. Menu - Get Product Detail (200)` | 15 | 2 | 3.9 | 7 | 7 |
| `05. Availability - Check Cart Stock (201)` | 15 | 2 | 3.3 | 5 | 5 |
| `06. Promotions - Get Active Promotions (200)` | 15 | 1 | 1.7 | 2 | 2 |
| `07. Promotions - Validate BREW20 (201)` | 15 | 1 | 1.7 | 3 | 3 |
| `08. Loyalty - Get Customer Points (200)` | 15 | 1 | 2.9 | 4 | 4 |
| `09. Orders - Create Order PENDING (201)` | 15 | 9 | 14.4 | 43 | 43 |
| `10. Orders - Get Order Detail (200)` | 15 | 2 | 3.9 | 6 | 6 |
| `11. Orders - Get Order History (200)` | 15 | 4 | 6.1 | 8 | 8 |
| `12. Auth - Login Barista (200)` | 15 | 58 | 61.9 | 65 | 65 |
| `13. Barista - Get Queue FIFO (200)` | 15 | 3 | 4.2 | 5 | 5 |

*(Lưu ý: `09. Orders - Create Order PENDING` chỉ dùng `25g` Robusta/vòng trên tổng `50,000g` seed; nên chạy `npx prisma db seed` sau các đợt test tải dài để hoàn nguyên tồn kho sạch).*

---

## 4. Kết quả Load Test Đồng thời (Node Concurrent Runner)

Mỗi Virtual User (VU) xoay vòng liên tục 5 endpoint (`GET /products`, `POST /products/availability`, `GET /promotions`, `POST /orders`, `GET /orders/me`):

| Kịch bản | Thời gian thực | Tổng Request | Throughput (req/s) | Avg (ms) | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) | `2xx` | `409 Conflict` | `5xx` / Network Error |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **10 VUs / 10s** | 10.07 s | 3,699 | **367.33** | 27.16 | 6.44 | 125.85 | 212.03 | 462.96 | 3,699 (`200`: 2,217; `201`: 1,482) | **0** | **0 (0.000%)** |
| **20 VUs / 15s** | 15.11 s | 2,854 | **188.94** | 105.62 | 33.17 | 317.17 | 1640.73 | 4888.22 | 2,854 (`200`: 1,708; `201`: 1,146) | **0** | **0 (0.000%)** |

**Nhận xét số liệu đo:**
- Không phát sinh bất kỳ lỗi `5xx`, network error hay `409 Conflict` nào trong cả hai mức tải 10 VUs và 20 VUs (cơ chế `SELECT ... FOR UPDATE` theo thứ tự ID nguyên liệu trong `OrdersService` ngăn được race condition/deadlock).
- Ở mức 20 VUs, p95 vẫn đạt `317.17 ms` (đạt NFR-01 `< 2000 ms`), nhưng `p99` tăng lên `1640.73 ms` và throughput giảm từ `367.33` xuống `188.94 req/s` do vừa tranh chấp khóa row `Ingredient` khi 20 VU cùng `POST /orders`, vừa do `GET /orders/me` chưa phân trang nên payload tăng dần theo lượng đơn tích lũy trong phiên test.

---

## 5. Kết quả Unit & Integration Test Suite (Codebase)

| Bộ kiểm thử | Lệnh chạy | Suites | Tests | Thời gian | Kết quả |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Backend Unit Tests** (`apps/api`) | `npm test -- --runInBand` | 20 / 20 | 310 / 310 | 4.185 s | **PASS** |
| **Backend Integration Tests** (`apps/api`, DB `brewlite_test`) | `npx prisma db seed && npm run test:integration` | 10 / 10 | 74 / 74 | 3.569 s | **PASS** |
| **Frontend Unit Tests** (`apps/web`) | `npm test -- --runInBand` | 19 / 19 | 139 / 139 | 7.628 s | **PASS** |

---

## 6. Hướng dẫn tự chạy trên Postman & tránh lỗi `ECONNREFUSED`

### A. Khởi động Backend trước khi bấm Send/Run (tránh `ECONNREFUSED 127.0.0.1:3005`)
- **Cách 1 (Docker Compose — khuyến nghị):**
  ```bash
  docker compose up -d
  ```
- **Cách 2 (Chạy bản compiled trên host với PostgreSQL port `5433`):**
  ```bash
  cd apps/api
  DATABASE_URL="postgresql://brewlite_user:brewlite_password@localhost:5433/brewlite_db?schema=public" npx prisma migrate deploy
  DATABASE_URL="postgresql://brewlite_user:brewlite_password@localhost:5433/brewlite_db?schema=public" npx prisma db seed
  npm run build
  DATABASE_URL="postgresql://brewlite_user:brewlite_password@localhost:5433/brewlite_db?schema=public" PORT=3005 NODE_ENV=production node dist/main
  ```
- Nếu chạy các bộ **Payments / Barista VNPay IPN**, hãy điền `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`, `VNPAY_FRONTEND_RETURN_URL` vào `.env` trước khi khởi động backend, và điền `VNPAY_HASH_SECRET` vào collection variable `vnpayHashSecret` trong Postman.

### B. Chạy trên Postman Desktop / Postman Web
1. Mở Postman -> **Import** các file `*.collection.json` trong `docs/testing/`.
2. **Kiểm thử chức năng:** Chọn collection chức năng -> **Run** (Collection Runner) -> giữ nguyên thứ tự request từ `01` đến cuối -> **Run**.
3. **Kiểm thử hiệu năng (tab Performance):** Chọn `BrewLite - Performance & Load Test Suite (Happy Path)` -> **Run** -> chuyển sang tab **Performance** -> chọn số **Virtual Users** (ví dụ `10` hoặc `20`) và **Test duration** -> **Run**.

### C. Chạy trên Postman VS Code Extension
1. Mở tab **Postman** trên thanh sidebar VS Code -> **Import** file `*.collection.json` từ `docs/testing/`.
2. Chuột phải vào collection -> **Run Collection** để chạy tuần tự tất cả request và xem kết quả tab **Test Results**.
3. *Lưu ý:* Postman VS Code Extension hiện chỉ hỗ trợ **Collection Runner** tuần tự; để chạy load test nhiều Virtual Users đồng thời, hãy dùng tab **Performance** trên **Postman Desktop** hoặc chạy Newman CLI (`npx newman run docs/testing/performance-postman.collection.json -n 15`).
