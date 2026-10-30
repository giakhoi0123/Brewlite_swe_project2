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

## Hướng dẫn khởi chạy MVP Sprint 1 (Task 4.3)

### 1. Yêu cầu môi trường
- **Node.js**: Phiên bản 20+ hoặc 22+
- **Docker & Docker Compose**: Đang chạy trên máy

### 2. Khởi động cơ sở dữ liệu PostgreSQL (Local)
Khởi động container PostgreSQL qua Docker Compose từ thư mục gốc của repository:
```bash
docker compose up -d
```
Trạng thái container có thể kiểm tra qua lệnh `docker ps` (service `brewlite-postgres` chạy tại cổng `5432`).

### 3. Cài đặt và di chuyển dữ liệu Backend (NestJS + Prisma)
```bash
cd apps/api
npm install
npx prisma migrate dev
npx prisma db seed
```
- Lệnh migrate sẽ áp dụng schema vào database `brewlite_db`.
- Lệnh seed sẽ nạp sẵn 8 sản phẩm mẫu, danh sách options (kích cỡ, topping) và số lượng tồn kho (idempotent seed).

### 4. Khởi chạy Backend API
```bash
cd apps/api
npm run start:dev
```
API sẽ lắng nghe tại: `http://localhost:3005/api` (hoặc cổng được cấu hình qua biến môi trường `PORT`).

**Hai endpoint chính thức:**
- `GET http://localhost:3005/api/products` (Hỗ trợ query tìm kiếm không phân biệt hoa thường: `GET http://localhost:3005/api/products?search=cà+phê`)
- `GET http://localhost:3005/api/products/:id` (Ví dụ: `GET http://localhost:3005/api/products/a0000000-0000-0000-0000-000000000001`)

### 5. Khởi chạy Giao diện Frontend (Next.js)
```bash
cd apps/web
npm install
npm run dev
```
Giao diện thực đơn web sẽ chạy tại: `http://localhost:3006` (hoặc cổng Next.js khả dụng).
Giao diện hỗ trợ đầy đủ thiết kế Mobile-First (tối ưu từ 360px), các trạng thái Loading Skeleton, Empty, Error và Retry phục hồi dữ liệu khi gọi API thật.

### 6. Thực thi kiểm thử (Testing)
- **Backend Unit Tests:** `cd apps/api && npm test`
- **Backend API & E2E Tests:** `cd apps/api && npm run test:e2e`
- **Frontend Component Tests:** `cd apps/web && npm test`
- **Build kiểm tra Production:**
  + Backend: `cd apps/api && npm run build`
  + Frontend: `cd apps/web && npm run build`
