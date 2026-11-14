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

## Cấu trúc đồ án (Project Structure)

Repository được tổ chức theo mô hình Monorepo (ADR-001) gồm Backend NestJS, Frontend Next.js và bộ tài liệu kỹ thuật/kiểm thử:

```text
BrewLite_swe_project_2/
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/ci.yml              # Quality Gate: preflight -> backend-ci + frontend-ci -> summary
├── apps/
│   ├── api/                          # NestJS Backend API (Port 3005, global prefix /api)
│   │   ├── Dockerfile
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # PostgreSQL schema (15 models, 10 enums)
│   │   │   ├── seed.ts               # Seed 8 sản phẩm, 15 nguyên liệu, 3 promotion, 2 tài khoản demo
│   │   │   └── migrations/           # 14 SQL migrations
│   │   ├── src/
│   │   │   ├── auth/                 # Đăng ký, đăng nhập JWT/Cookie, quên/đặt lại/đổi mật khẩu, RBAC
│   │   │   ├── products/             # Danh mục món, chi tiết món & kiểm tra tồn nguyên liệu (availability)
│   │   │   ├── orders/               # Tạo đơn, giữ tồn kho (FOR UPDATE), state machine & Barista Queue
│   │   │   ├── payments/             # Thanh toán VNPay Sandbox (IPN, Return), Idempotency-Key & Mock (test)
│   │   │   ├── promotions/           # Danh sách & kiểm tra mã giảm giá
│   │   │   ├── loyalty/              # Tích điểm, lịch sử LoyaltyTransaction & đổi điểm lấy voucher
│   │   │   └── prisma/               # PrismaService & module kết nối DB
│   │   └── test/                     # E2E & PostgreSQL Integration tests
│   └── web/                          # Next.js 14 App Router Frontend (Port 3006)
│       ├── Dockerfile
│       └── src/
│           ├── app/                  # Các route: /, /products, /products/[slug], /gio-hang, /checkout,
│           │                       # /checkout/vnpay-return, /thanh-toan, /khuyen-mai, /lich-su-don-hang,
│           │                       # /barista, /login, /register, /forgot-password, /reset-password
│           ├── components/           # UI components (auth, cart, menu, product-detail, layout, ui)
│           ├── services/             # API clients (auth-api, product-api, checkout-api, barista-api)
│           ├── lib/                  # Logic giỏ hàng, tính giá, bộ lọc & helper
│           └── types/                # TypeScript interfaces
├── docs/
│   ├── architecture/                 # architecture.md & ADR 001..005
│   ├── contracts/                    # API contracts (products, availability, payments, mock)
│   ├── diagrams/                     # Sơ đồ PlantUML (.puml) & ảnh (.png)
│   ├── requirements/                 # SRS, context-and-scope, usecase-checkout
│   └── testing/                      # Hướng dẫn test, acceptance records, E2E & deployment healthcheck
├── docker-compose.yml                # Full-stack containers (postgres, migration, api, web)
├── docker-compose.test.yml           # PostgreSQL tmpfs cô lập cho integration test (port 55432)
└── .env.example                      # Biến môi trường mẫu cho Docker Compose
```

---

## Full Stack Deployment with Docker Compose

Phần hướng dẫn này dành cho Giảng viên, Reviewer và thành viên nhóm để thiết lập và vận hành toàn bộ hệ thống BrewLite (Next.js Frontend + NestJS Backend API + PostgreSQL + Prisma Auto Migration) trong môi trường Docker hóa đồng nhất.

### 1. Kiến trúc triển khai tổng thể

Toàn bộ hệ thống được container hóa phối hợp trên cùng mạng nội bộ Docker bridge:

```mermaid
flowchart TD
    subgraph Host["Host Machine / External"]
        Browser["Web Browser (Client CSR)"]
        DevOps["DevOps / CLI (docker compose)"]
        VNPay["VNPay Sandbox\n(External Payment Gateway)"]
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
            NestAPI["NestJS Backend API (Port 3005 /api)\n- AuthModule (JWT/Cookie + RBAC)\n- ProductsModule (Catalog & Availability)\n- OrdersModule (Orders, Inventory & Barista)\n- PaymentsModule (VNPay Sandbox & Idempotency)\n- PromotionsModule & LoyaltyModule\n- PrismaModule"]
        end

        subgraph WebContainer["Container: brewlite-web"]
            NextServer["Next.js Node Server (Port 3006)\n- App Router Pages & Static/CSR Bundles"]
        end
    end

    %% Startup dependency flow
    PostgresContainer -- "1. Healthcheck: pg_isready" --> MigrationContainer
    MigrationContainer -- "2. Schema Applied (Exit 0)" --> APIContainer
    APIContainer -- "3. Healthcheck: GET /api/products" --> WebContainer

    %% Runtime network traffic
    Migrate -. "TCP: postgres:5432" .-> PG
    NestAPI -. "DATABASE_URL: postgres:5432" .-> PG

    %% External Host & Payment Gateway exposure
    DevOps ==>|docker compose up| DockerNet
    Browser ==>|HTTP: localhost:3006| NextServer
    Browser ==>|REST JSON + Bearer/Cookie\nNEXT_PUBLIC_API_URL: localhost:3005/api| NestAPI
    Browser -. "Redirect checkoutUrl / Return URL" .-> VNPay
    VNPay -. "IPN: GET /api/payments/vnpay-ipn\n(Public HTTPS / Tunnel)" .-> NestAPI
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
| `VNPAY_TMN_CODE` | *(do VNPay Sandbox cấp)* | Mã website/merchant dùng để tạo và xác thực giao dịch Sandbox |
| `VNPAY_HASH_SECRET` | *(bí mật do VNPay Sandbox cấp)* | Khóa HMAC-SHA512, chỉ cấu hình ở backend và không commit |
| `VNPAY_PAYMENT_URL` | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` | Cổng thanh toán VNPay Sandbox |
| `VNPAY_RETURN_URL` | `http://localhost:3005/api/payments/vnpay-return` | URL VNPay chuyển trình duyệt về sau thanh toán |
| `VNPAY_IPN_URL` | `http://localhost:3005/api/payments/vnpay-ipn` | URL server-to-server cần đăng ký trong cấu hình merchant VNPay |
| `VNPAY_FRONTEND_RETURN_URL` | `http://localhost:3006/checkout/vnpay-return` | Trang hiển thị và polling kết quả sau Return URL |
| `WEB_PORT` | `3006` | Cổng dịch vụ Next.js Frontend Web trên máy host |
| `NEXT_PUBLIC_API_URL`| `http://localhost:3005/api` | Địa chỉ Backend API được Client-side browser gọi trực tiếp |

Đăng ký bộ khóa thử nghiệm tại cổng VNPay Sandbox rồi điền `VNPAY_TMN_CODE` và
`VNPAY_HASH_SECRET` vào `.env`. IPN phải là URL HTTPS công khai để máy chủ VNPay truy cập được;
khi chạy local, dùng tunnel HTTPS hoặc URL API đã deploy và đăng ký đúng URL đó với VNPay.

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
  - Trang Thực đơn & Chi tiết món: [http://localhost:3006/products](http://localhost:3006/products), `/products/<UUID>`
  - Giỏ hàng: [http://localhost:3006/gio-hang](http://localhost:3006/gio-hang)
  - Thanh toán & Nhận kết quả VNPay: [http://localhost:3006/checkout](http://localhost:3006/checkout) (alias: `/thanh-toan`), `/checkout/vnpay-return`
  - Khuyến mãi & Điểm thưởng Loyalty: [http://localhost:3006/khuyen-mai](http://localhost:3006/khuyen-mai)
  - Lịch sử đơn hàng: [http://localhost:3006/lich-su-don-hang](http://localhost:3006/lich-su-don-hang)
  - Tài khoản: [http://localhost:3006/login](http://localhost:3006/login), `/register`, `/forgot-password`, `/reset-password`
  - Quầy Barista Dashboard: [http://localhost:3006/barista](http://localhost:3006/barista) *(yêu cầu tài khoản `BARISTA` hoặc `MANAGER`)*
- **Backend API (NestJS):** [http://localhost:3005/api](http://localhost:3005/api)
  - Products & Availability: `GET /api/products`, `GET /api/products/:id`, `POST /api/products/availability`
  - Auth: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/change-password`
  - Orders & Barista: `POST /api/orders`, `GET /api/orders/me`, `GET /api/orders/:id`, `GET /api/barista/orders`, `POST /api/barista/orders/:id/{accept,ready,complete}`
  - Payments (VNPay Sandbox): `POST /api/payments`, `GET /api/payments/:paymentId`, `GET /api/payments/vnpay-return`, `GET /api/payments/vnpay-ipn`
  - Promotions & Loyalty: `GET/POST /api/promotions`, `POST /api/promotions/validate`, `GET /api/loyalty/user/:userId`, `POST /api/loyalty/earn`, `POST /api/loyalty/redeem`
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
   - Giao diện Next.js sử dụng Client-side Rendering (CSR) và `fetch` API (`apps/web/src/services/*`). Các request API này được thực thi bởi trình duyệt web trên máy người dùng bên ngoài Docker.
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

## Hướng dẫn thiết lập và khởi chạy Local (Clean Setup)

Hướng dẫn này dành cho thành viên mới clone repository hoặc kiểm tra nghiệm thu độc lập khi chỉ chạy PostgreSQL bằng Docker và chạy `apps/api`, `apps/web` trực tiếp bằng Node.js.

### Tóm tắt tích hợp luồng chính trên giao diện

- **Thực đơn & Tồn kho:** `/products` lấy danh sách từ `GET /api/products`; `/products/<UUID>` lấy chi tiết từ `GET /api/products/:id` và kiểm tra tồn nguyên liệu theo định lượng qua `POST /api/products/availability`. Không tự chuyển sang dữ liệu mock khi API lỗi.
- **Giỏ hàng & Khuyến mãi / Loyalty:** `/gio-hang` tái kiểm tra tồn kho (`POST /api/products/availability`), áp dụng mã giảm giá (`POST /api/promotions/validate`), và `/khuyen-mai` hỗ trợ xem ưu đãi & đổi điểm (`GET /api/loyalty/user/:userId`, `POST /api/loyalty/redeem`).
- **Đặt hàng & Thanh toán VNPay Sandbox:** `/checkout` (và `/thanh-toan`) yêu cầu đăng nhập, gọi `POST /api/orders` (tính lại giá, trừ tồn kho và giữ chỗ reservation ở server) rồi gọi `POST /api/payments` (`method: "VNPAY"`, `Idempotency-Key`) để nhận `checkoutUrl` chuyển sang VNPay Sandbox. Kết quả được ghi nhận qua `GET /api/payments/vnpay-ipn` và hiển thị bằng polling `GET /api/payments/:paymentId` tại `/checkout/vnpay-return`. *(Lưu ý: `MockPaymentGatewayAdapter` chỉ kích hoạt khi `NODE_ENV=test` phục vụ kiểm thử tự động).*
- **Barista & Lịch sử:** `/lich-su-don-hang` đọc `GET /api/orders/me` và `/barista` vận hành hàng đợi `PAID -> PREPARING -> READY -> COMPLETED`.

### 1. Yêu cầu tiên quyết
- **Node.js**: Phiên bản 20+ hoặc 22+
- **Docker & Docker Compose**: Đang chạy trên máy

### 2. Thiết lập biến môi trường (Environment Configuration)
Repository cung cấp các file mẫu cấu hình tách biệt theo từng thành phần:
```bash
# 1. Cấu hình Docker Compose / PostgreSQL local (tại thư mục gốc)
cp .env.example .env

# 2. Cấu hình NestJS API và Prisma CLI (bao gồm các biến VNPAY_*)
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
- `npx prisma migrate deploy`: Áp dụng toàn bộ lịch sử 14 migration trong `apps/api/prisma/migrations/` (từ Product, Auth, Ingredient/OptionRecipe, Promotion, LoyaltyTransaction, Order/Reservation đến Payment/VNPay Sandbox) vào database sạch mà không cần reset dữ liệu.
- `npx prisma db seed`: Nạp sẵn 8 sản phẩm mẫu, 15 nguyên liệu + công thức, 3 mã khuyến mãi (`HELLOBREW`, `BREW20`, `EXPIRED10`) và 2 tài khoản demo (`customer@brewlite.test`, `barista@brewlite.test`).

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
Giao diện web sẽ chạy tại: `http://localhost:3006`.

### 7. Thực thi kiểm thử (Testing)
- **Backend Unit Tests:** `cd apps/api && npm test`
- **Backend PostgreSQL Integration/E2E:** dùng database test riêng (`docker compose -f docker-compose.test.yml up -d` hoặc theo [hướng dẫn Task 4](docs/testing/task4-kiet-test-guide.md)), sau đó chạy `npm run test:integration` hoặc `npm run test:e2e -- --runInBand`
- **Frontend Component & API Tests:** `cd apps/web && npm test`
- **Typecheck & Lint:**
  - Backend: `cd apps/api && npm run lint`
  - Frontend: `cd apps/web && npm run lint && npx tsc --noEmit`
- **Biên dịch Production (Build):**
  - Backend: `cd apps/api && npm run build`
  - Frontend: `cd apps/web && npm run build`

### Tài liệu tham khảo & Kiểm thử liên quan
- [API Contract — VNPay Sandbox](docs/contracts/payments-api.md)
- [Hướng dẫn chạy test Task 4](docs/testing/task4-kiet-test-guide.md)
- [Biên bản nghiệm thu Task 4](docs/testing/task4-kiet-acceptance.md)
- [Biên bản nghiệm thu Payment Task 5](docs/testing/task5-kiet-payment-acceptance.md)
- [Báo cáo kiểm thử E2E](docs/testing/e2e-report.md)
- [Kiểm tra triển khai & Healthcheck Production](docs/testing/deployment-healthcheck.md)
- [Release Notes](docs/RELEASE_NOTES.md) & [Sprint Retrospective](docs/SPRINT_RETROSPECTIVE.md)
