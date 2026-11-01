# Brewlite_swe_project2

## Git Workflow & Contribution

Quy chuẩn làm việc và đóng góp mã nguồn của nhóm BrewLite:

- **Nhánh riêng theo task:** Mỗi thành viên phát triển trên branch riêng được đặt tên theo module hoặc task (ví dụ: `feature/task4-khoi-sprint1`, `feature/products-api`).
- **Không làm việc trực tiếp trên main:** Tuyệt đối không commit hoặc push trực tiếp lên nhánh `main`. Không force push nhánh `main`.
- **Conventional Commits:** Đặt thông điệp commit theo chuẩn Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`). Mỗi commit phản ánh đúng một thay đổi thực tế.
- **Tích hợp qua Pull Request:** Mọi thay đổi đều phải tạo Pull Request vào `main` và sử dụng mẫu tại `.github/PULL_REQUEST_TEMPLATE.md`.
- **Kiểm tra CI & Code Review:** Bắt buộc vượt qua các bước kiểm tra tự động của CI và có sự xem xét, chấp thuận của thành viên khác trước khi merge.
- **Bảo toàn lịch sử:** Không thay đổi tác giả hoặc thời gian commit; giữ tính toàn vẹn và minh bạch của lịch sử Git.
- **Tôn trọng phân công:** Không tự ý viết code thay cho phần việc của thành viên khác.
- **Dọn dẹp branch:** Xóa branch tính năng sau khi merge thành công và đã xác minh an toàn trên `main`.
- **Quy định hoàn thành:** Tuân thủ đầy đủ 10 tiêu chí nghiệm thu tại [docs/DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md).

---

## Hướng dẫn thiết lập và khởi chạy Clean Setup (Sprint 1 MVP)

Hướng dẫn này dành cho thành viên mới clone repository hoặc kiểm tra nghiệm thu độc lập trên môi trường sạch.

### 1. Yêu cầu tiên quyết
- **Node.js**: Phiên bản 20+ hoặc 22+
- **Docker & Docker Compose**: Đang chạy trên máy

### 2. Thiết lập biến môi trường (Environment Configuration)
Repository cung cấp các file mẫu cấu hình tách biệt theo từng thành phần (consumer-specific template):
```bash
# 1. Cấu hình container PostgreSQL local (tại thư mục gốc)
cp .env.example .env

# 2. Cấu hình NestJS API và Prisma CLI
cp apps/api/.env.example apps/api/.env

# 3. Cấu hình Next.js Web frontend
cp apps/web/.env.example apps/web/.env
```
*Lưu ý:* Các file `.env` chứa cấu hình nội bộ local và đã được `.gitignore` bảo vệ tuyệt đối.

### 3. Khởi động cơ sở dữ liệu PostgreSQL
Từ thư mục gốc repository:
```bash
docker compose up -d
```
Kiểm tra trạng thái container: `docker ps` (service `brewlite-postgres` chạy tại cổng `5432`, trạng thái healthy).

### 4. Cài đặt và di chuyển dữ liệu Backend (NestJS + Prisma)
Từ thư mục gốc repository:
```bash
cd apps/api
npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```
- `npx prisma migrate deploy`: Áp dụng lịch sử migration đã có (`20261030173126_init_product_schema`) vào database sạch mà không cần reset dữ liệu.
- `npx prisma db seed`: Nạp sẵn 8 sản phẩm mẫu, danh mục kích cỡ/topping và số lượng tồn kho (seed lặp lại an toàn qua upsert).

### 5. Khởi chạy Backend API
Sau khi hoàn thành bước 4 (vẫn ở trong `apps/api`):
```bash
npm run start:dev
```
API sẽ lắng nghe tại: `http://localhost:3005/api`.
CORS được cấu hình whitelist cho frontend tại: `http://localhost:3006`.

**Hai endpoint chính thức:**
- `GET http://localhost:3005/api/products` (Hỗ trợ query tìm kiếm không phân biệt hoa thường: `GET http://localhost:3005/api/products?search=cà+phê`)
- `GET http://localhost:3005/api/products/:id` (Ví dụ: `GET http://localhost:3005/api/products/a0000000-0000-0000-0000-000000000001`)

### 6. Khởi chạy Giao diện Frontend (Next.js)
Mở cửa sổ terminal mới từ thư mục gốc repository:
```bash
cd apps/web
npm ci
npm run dev
```
Giao diện thực đơn web sẽ chạy tại: `http://localhost:3006`.
Giao diện tối ưu Mobile-First (chuẩn từ 360px) và hỗ trợ đầy đủ 4 trạng thái: Loading Skeleton, Empty, Error và Retry phục hồi khi gọi live API.

### 7. Thực thi kiểm thử (Testing)
- **Backend Unit Tests:** `cd apps/api && npm test`
- **Backend PostgreSQL Integration/E2E:** dùng database test riêng theo [hướng dẫn Task 4](docs/testing/task4-kiet-test-guide.md), sau đó chạy `npm run test:integration` hoặc `npm run test:e2e -- --runInBand`
- **Frontend Component & API Tests:** `cd apps/web && npm test`
- **Biên dịch Production (Build):**
  - Backend: `cd apps/api && npm run build`
  - Frontend: `cd apps/web && npm run build`

Chi tiết kiểm thử và nghiệm thu phần Task 4 của Nguyễn Tuấn Kiệt:

- [Hướng dẫn chạy test](docs/testing/task4-kiet-test-guide.md)
- [Biên bản nghiệm thu và bằng chứng](docs/testing/task4-kiet-acceptance.md)
