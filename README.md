# Brewlite_swe_project2

## Git Workflow & Contribution

Quy chuẩn làm việc và đóng góp mã nguồn của nhóm BrewLite:

- **Nhánh riêng theo task:** Mỗi thành viên phát triển trên branch riêng được đặt tên theo module hoặc task (ví dụ: `feature/task4-khoi-sprint1`, `feature/task5-khoi-auth-checkout-barista`).
- **Không làm việc trực tiếp trên main:** Tuyệt đối không commit hoặc push trực tiếp lên nhánh `main`. Không force push nhánh `main`.
- **Conventional Commits:** Đặt thông điệp commit theo chuẩn Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`). Mỗi commit phản ánh đúng một thay đổi thực tế.
- **Tích hợp qua Pull Request:** Mọi thay đổi đều phải tạo Pull Request vào `main` và sử dụng mẫu tại `.github/PULL_REQUEST_TEMPLATE.md`.
- **Kiểm tra CI & Code Review:** Bắt buộc vượt qua các bước kiểm tra tự động của CI và có sự xem xét, chấp thuận của thành viên khác trước khi merge.
- **Bảo toàn lịch sử:** Không thay đổi tác giả hoặc thời gian commit; giữ tính toàn vẹn và minh bạch của lịch sử Git.
- **Tôn trọng phân công:** Không tự ý viết code thay cho phần việc của thành viên khác.
- **Dọn dẹp branch:** Xóa branch tính năng sau khi merge thành công và đã xác minh an toàn trên `main`.
- **Quy định hoàn thành:** Tuân thủ đầy đủ 10 tiêu chí nghiệm thu tại [docs/DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md).

---

## Full Stack Deployment with Docker Compose

Phần hướng dẫn này dành cho Giảng viên, Reviewer và thành viên nhóm để thiết lập và vận hành toàn bộ hệ thống BrewLite (Next.js Frontend + NestJS Backend API + PostgreSQL + Prisma Auto Migration) trong môi trường Docker hóa đồng nhất.

### 1. Kiến trúc triển khai tổng thể

Toàn bộ hệ thống được container hóa theo mô hình micro-services phối hợp trên cùng mạng nội bộ Docker bridge:

```mermaid
flowchart TD
    subgraph Host["Host Machine / User Environment"]
        Browser["Web Browser (User Client)"]
        DevOps["DevOps / CLI (docker compose)"]
    end

    subgraph DockerNet["Docker Network: brewlite_swe_project_2_default"]
        subgraph PostgresContainer["Container: brewlite-postgres"]
            PG["PostgreSQL 16 (Port 5432)"]
            PGVolume[("Named Volume: brewlite-pgdata")]
            PG --- PGVolume
        end

        subgraph MigrationContainer["Container: brewlite-migration (One-shot)"]
            Migrate["npx prisma migrate deploy"]
        end

        subgraph APIContainer["Container: brewlite-api"]
            NestAPI["NestJS Backend API (Port 3005)\n- Products Module\n- Auth Module (JWT + RBAC)\n- Prisma Client"]
        end

        subgraph WebContainer["Container: brewlite-web"]
            NextServer["Next.js Node Server (Port 3006)\n- Server Components\n- SSR Engine"]
        end
    end

    %% Dependency flow
    PostgresContainer -- "1. Healthcheck: pg_isready" --> MigrationContainer
    MigrationContainer -- "2. Schema Applied (Completed 0)" --> APIContainer
    APIContainer -- "3. Healthcheck: /api/products" --> WebContainer

    %% Runtime network traffic
    Migrate -. "TCP: postgres:5432" .-> PG
    NestAPI -. "DATABASE_URL: postgres:5432" .-> PG
    NextServer -. "SSR Fetch (nội bộ)" .-> NestAPI

    %% External Host exposure
    DevOps ==>|docker compose up| DockerNet
    Browser ==>|HTTP: localhost:3006| NextServer
    Browser ==>|HTTP: localhost:3005/api| NestAPI
```

### 2. Yêu cầu môi trường tiên quyết
- **Docker Engine**: Phiên bản 24.0 trở lên (khuyến nghị Docker Desktop 4.25+).
- **Docker Compose**: Compose v2 hoặc v5 (lệnh `docker compose`).
- **Tài nguyên phần cứng khuyến nghị**: Tối thiểu 4GB RAM trống và 5GB dung lượng đĩa khả dụng.
- **Kiến trúc CPU**: Tương thích đầy đủ cả x86_64/AMD64 và Apple Silicon ARM64 (`aarch64`).

### 3. Chuẩn bị biến môi trường (Environment Configuration)
Sao chép file cấu hình mẫu từ thư mục gốc repository:
```bash
cp .env.example .env
```

**Bảng giải thích ý nghĩa các biến môi trường:**

| Biến môi trường | Giá trị mặc định | Giải thích chi tiết |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `brewlite_user` | Tên tài khoản quản trị PostgreSQL trong container |
| `POSTGRES_PASSWORD` | `brewlite_password` | Mật khẩu truy cập cơ sở dữ liệu PostgreSQL |
| `POSTGRES_DB` | `brewlite_db` | Tên database chính thức của ứng dụng |
| `POSTGRES_PORT` | `5432` | Cổng ánh xạ PostgreSQL ra máy host (dành cho GUI/psql ngoài Docker) |
| `DATABASE_URL` | `postgresql://brewlite_user:...@postgres:5432/brewlite_db` | Chuỗi kết nối Prisma nội bộ Docker network (hostname `postgres`) |
| `PORT` / `API_PORT` | `3005` | Cổng dịch vụ Backend NestJS API |
| `NODE_ENV` | `production` | Môi trường thực thi của NodeJS runtime |
| `JWT_SECRET` | *(chuỗi bí mật)* | Khóa bí mật ký và giải mã JWT access token |
| `JWT_EXPIRES_IN` | `1d` | Thời hạn hiệu lực của access token (1 ngày) |
| `CORS_ORIGIN` | `http://localhost:3006` | Danh sách tên miền frontend được phép gọi API (CORS whitelist) |
| `WEB_PORT` | `3006` | Cổng dịch vụ Next.js Frontend Web trên máy host |
| `NEXT_PUBLIC_API_URL`| `http://localhost:3005/api` | Địa chỉ Backend API được Client-side browser gọi trực tiếp |

### 4. Lệnh một bước khởi chạy (Single-command Startup)
Từ thư mục gốc của repository, thực hiện:
```bash
docker compose up --build -d
```

**Trình tự khởi động an toàn tự động (Choreography):**
1. Service `postgres` khởi động; Docker thực hiện kiểm tra `pg_isready` mỗi 5s.
2. Khi `postgres` đạt trạng thái `healthy`, service `migration` được kích hoạt để thực thi `npx prisma migrate deploy`.
3. Sau khi migrations áp dụng thành công (exit code 0), service `api` bắt đầu khởi chạy và lắng nghe tại cổng `3005`.
4. Khi `api` vượt qua healthcheck, service `web` khởi động và phục vụ giao diện tại cổng `3006`.

### 5. Quản lý Prisma Database Migration
Hệ thống đã cấu hình tự động chạy migration khi khởi động thông qua container `migration`. Để kiểm tra hoặc áp dụng lại migration thủ công bên trong container API đang chạy:
```bash
docker compose exec api npx prisma migrate deploy
```
*Lưu ý:* `prisma migrate deploy` là lệnh an toàn sản xuất (production-safe): áp dụng các file SQL migration chưa chạy mà không xóa hoặc thay đổi dữ liệu hiện hữu.

### 6. Nạp dữ liệu khởi tạo mẫu (Database Seed)
Nạp dữ liệu mẫu bao gồm 8 sản phẩm đồ uống, các nhóm kích cỡ/topping, định mức tồn kho và các tài khoản demo kiểm thử:
```bash
docker compose exec api npx prisma db seed
```

**Tài khoản demo sẵn sàng đăng nhập sau khi seed:**
- **Khách hàng (Customer):**
  - Email: `customer@brewlite.test`
  - Mật khẩu: `Password123!`
  - Vai trò: `CUSTOMER` (đặt hàng, quản lý thông tin, xem giỏ hàng)
- **Nhân viên quầy pha chế (Barista):**
  - Email: `barista@brewlite.test`
  - Mật khẩu: `Password123!`
  - Vai trò: `BARISTA` (truy cập Barista Dashboard, quản lý đơn pha chế)

### 7. Kiểm tra trạng thái và theo dõi Logs
Kiểm tra tình trạng các container đang chạy:
```bash
docker compose ps
```
Theo dõi log thời gian thực của từng dịch vụ:
```bash
# Xem log toàn bộ hệ thống
docker compose logs -f

# Xem log riêng Backend API
docker compose logs -f api

# Xem log riêng Frontend Web
docker compose logs -f web

# Xem log lịch sử Migration
docker compose logs migration
```

### 8. Địa chỉ truy cập các dịch vụ
Sau khi các container ở trạng thái `healthy` hoặc `running`:
- **Giao diện người dùng Web (Next.js):** [http://localhost:3006](http://localhost:3006)
  - Trang Thực đơn: [http://localhost:3006/thuc-don](http://localhost:3006/thuc-don)
  - Trang Đăng nhập: [http://localhost:3006/login](http://localhost:3006/login)
  - Trang Đăng ký: [http://localhost:3006/register](http://localhost:3006/register)
  - Trang Thanh toán: [http://localhost:3006/thanh-toan](http://localhost:3006/thanh-toan)
  - Quầy Barista Dashboard: [http://localhost:3006/barista](http://localhost:3006/barista) *(yêu cầu đăng nhập tài khoản Barista)*
- **Backend API (NestJS):** [http://localhost:3005/api](http://localhost:3005/api)
  - Danh sách sản phẩm: `GET http://localhost:3005/api/products`
  - Đăng nhập API: `POST http://localhost:3005/api/auth/login`
- **Cơ sở dữ liệu PostgreSQL:** `localhost:5432` (hoặc cổng cấu hình tại `POSTGRES_PORT`).

### 9. Quy trình dừng và dọn dẹp an toàn
Dừng toàn bộ hệ thống mà vẫn **giữ nguyên toàn bộ dữ liệu** trong PostgreSQL:
```bash
docker compose down
```
Khởi động lại hệ thống tiếp tục sử dụng dữ liệu cũ:
```bash
docker compose up -d
```
> [!CAUTION]
> **CẢNH BÁO MẤT DỮ LIỆU:** Tuyệt đối **KHÔNG** sử dụng cờ `-v` (`docker compose down -v`) trên môi trường vận hành thực tế. Cờ `-v` sẽ xóa vĩnh viễn named volume `brewlite-pgdata`, dẫn đến mất sạch toàn bộ người dùng, sản phẩm và giao dịch.

### 10. Quy trình Rollback khi gặp sự cố
Khi triển khai phiên bản mới hoặc cập nhật gặp lỗi, áp dụng các bước rollback sau:

#### A. Rollback mã nguồn ứng dụng (Application Containers)
1. Quay về commit hoặc release tag ổn định trước đó:
   ```bash
   git checkout <stable-commit-hash-or-tag>
   ```
2. Build và khởi chạy lại các container từ phiên bản ổn định:
   ```bash
   docker compose up --build -d
   ```
3. Xác minh tính toàn vẹn hệ thống: `docker compose ps` và `curl http://localhost:3005/api/products`.

#### B. Xử lý Rollback Migration cơ sở dữ liệu
- Prisma Migrate hoạt động theo nguyên tắc hướng tới (forward migrations only) và không hỗ trợ lệnh hạ cấp tự động `down`.
- **Nếu migration mới làm hỏng schema hoặc gặp lỗi:**
  1. Viết một migration mới để điều chỉnh lại cấu trúc hoặc khôi phục cột/bảng (compensating migration).
  2. Nếu một migration bị kẹt ở trạng thái failed trong bảng `_prisma_migrations`, đánh dấu đã rollback thủ công:
     ```bash
     docker compose exec api npx prisma migrate resolve --rolled-back <ten_migration_bi_loi>
     ```
  3. Sau khi sửa file migration, thực thi lại:
     ```bash
     docker compose exec api npx prisma migrate deploy
     ```

### 11. Sao lưu và Phục hồi cơ sở dữ liệu (Backup & Disaster Recovery)
#### A. Sao lưu dữ liệu (Backup)
Xuất bản sao lưu dữ liệu toàn phần ra file SQL trên máy host:
```bash
docker compose exec -T postgres pg_dump -U brewlite_user brewlite_db > backup_$(date +%Y%m%d_%H%M%S).sql
```
*(Nếu sử dụng credentials tùy biến từ `.env`, thay thế `brewlite_user` và `brewlite_db` bằng biến tương ứng).*

#### B. Phục hồi dữ liệu (Restore)
Nạp lại file sao lưu vào cơ sở dữ liệu trong container:
```bash
cat backup_YYYYMMDD_HHMMSS.sql | docker compose exec -T postgres psql -U brewlite_user -d brewlite_db
```

### 12. Phân tích khác biệt kiến trúc mạng (Networking Distinction — ADR-005)
Một trong những lỗi phổ biến nhất khi triển khai full-stack với Docker là nhầm lẫn giữa mạng nội bộ Docker và mạng máy trạm của người dùng. BrewLite giải quyết triệt để theo kiến trúc sau:

1. **Giao tiếp nội bộ Docker (Server-to-Server):**
   - Container `api` và `migration` kết nối với `postgres` qua hostname dịch vụ nội bộ: `postgres:5432`.
   - Trong mạng Docker, `localhost` chỉ đại diện cho chính container cục bộ đó. Nếu cấu hình API kết nối tới `localhost:5432`, kết nối sẽ bị từ chối (`ECONNREFUSED`).
2. **Giao tiếp ngoài máy host (Client Browser to API):**
   - Giao diện Next.js sử dụng kỹ thuật Client-side Rendering (CSR) và React Hooks (`useEffect`, `fetch`, `axios`). Các lệnh gọi API này được thực thi bởi trình duyệt web trên máy tính của người dùng bên ngoài Docker.
   - Trình duyệt **không nằm trong Docker network** nên hoàn toàn không thể phân giải hostname `http://api:3005`.
   - Do đó, `NEXT_PUBLIC_API_URL` bắt buộc phải trỏ về `http://localhost:3005/api` (hoặc IP/domain public của máy chủ host).
   - Biến `NEXT_PUBLIC_*` được nhúng trực tiếp vào mã nguồn JavaScript tại thời điểm đóng gói image (`docker build`), vì vậy Dockerfile `apps/web/Dockerfile` tiếp nhận giá trị này qua `ARG NEXT_PUBLIC_API_URL`.

### 13. Xử lý sự cố thường gặp (Troubleshooting Guide)

| Tình huống sự cố | Nguyên nhân gốc | Hướng xử lý |
| :--- | :--- | :--- |
| **Port already allocated (3005, 3006, 5432)** | Một tiến trình Node/Postgres khác trên máy host đang chiếm dụng cổng | Chạy `lsof -i :3005` (hoặc 3006, 5432) để tìm PID và dừng tiến trình cũ; hoặc điều chỉnh `API_PORT`, `WEB_PORT`, `POSTGRES_PORT` trong file `.env`. |
| **API báo lỗi `ECONNREFUSED` khi kết nối Postgres** | PostgreSQL chưa sẵn sàng hoặc API dùng sai hostname `localhost` | Kiểm tra chuỗi `DATABASE_URL` trong Docker compose phải dùng hostname `postgres`. Đảm bảo khối `depends_on` có điều kiện `service_healthy`. |
| **Next.js gọi API thất bại (Network Error / CORS)** | Trình duyệt gọi nhầm hostname `http://api:3005` hoặc sai cổng CORS | Kiểm tra giá trị `NEXT_PUBLIC_API_URL` phải là `http://localhost:3005/api`. Kiểm tra `CORS_ORIGIN` trong `api` khớp với địa chỉ `http://localhost:3006`. |
| **Prisma báo lỗi `Query engine not found`** | Dockerfile nền tảng Debian slim thiếu OpenSSL cho engine binary | Dockerfile đã cấu hình cài đặt sẵn `openssl` qua `apt-get install -y openssl` trong tất cả các stage. |
| **Dữ liệu bị trắng sau khi tạo lại container** | Khởi chạy sai tên volume hoặc dùng nhầm `-v` | Đảm bảo `docker-compose.yml` khai báo named volume `brewlite-pgdata: driver: local`. Không dùng lệnh `docker compose down -v`. |

---

## Hướng dẫn thiết lập và khởi chạy Clean Setup (Sprint 1 MVP)

Hướng dẫn này dành cho thành viên mới clone repository hoặc kiểm tra nghiệm thu độc lập trên môi trường sạch không sử dụng Docker cho toàn bộ web/API.

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
docker compose up -d postgres
```
Kiểm tra trạng thái container: `docker compose ps` (service `brewlite-postgres` chạy tại cổng `5432`, trạng thái healthy).

### 4. Cài đặt và di chuyển dữ liệu Backend (NestJS + Prisma)
Từ thư mục gốc repository:
```bash
cd apps/api
npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```
- `npx prisma migrate deploy`: Áp dụng lịch sử migration đã có (`20261030173126_init_product_schema`, `20261031040439_add_product_option_index_and_inventory_constraints`, `20261103221500_add_user_and_auth_schema`) vào database sạch mà không cần reset dữ liệu.
- `npx prisma db seed`: Nạp sẵn sản phẩm mẫu, danh mục kích cỡ/topping, định mức tồn kho và tài khoản demo.

### 5. Khởi chạy Backend API
Sau khi hoàn thành bước 4 (vẫn ở trong `apps/api`):
```bash
npm run start:dev
```
API sẽ lắng nghe tại: `http://localhost:3005/api`.
CORS được cấu hình whitelist cho frontend tại: `http://localhost:3006`.

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
