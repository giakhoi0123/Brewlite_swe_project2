# ☕ BrewLite — Coffee Ordering System (Monorepo)

Dự án môn **Công nghệ Phần mềm (SWE)** xây dựng hệ thống đặt cà phê theo kiến trúc Monorepo, tích hợp Vertical Slice Architecture và quản lý bằng Git-flow.

---

## 🛠️ Tech Stack Chuẩn Hóa
- **Frontend:** Next.js (App Router), React, TypeScript, TailwindCSS
- **Backend:** NestJS (REST API, TypeScript)
- **Database & ORM:** PostgreSQL 15, Prisma ORM
- **DevOps:** Docker & Docker Compose
- **Auth:** JWT, Passport, Bcrypt hashing

---

## 📂 Cấu Trúc Monorepo
```text
brewlite_swe_project/
├── backend/                  # NestJS API Server
│   ├── prisma/               # Schema và migrations Prisma
│   └── src/                  # Controllers, Services, Modules (Auth, Products,...)
├── frontend/                 # Next.js Web Client
│   └── src/                  # App router, Components, Store
├── docs/                     # Tài liệu thiết kế & quy trình Task 1 - 4
│   ├── requirements/         # Yêu cầu (Task 1: Context & Scope, SRS, Use Case)
│   ├── diagrams/             # Sơ đồ UML (Task 2: Use Case, Activity, Sequence, Class)
│   ├── architecture/         # Kiến trúc hệ thống (Task 3: ADR, Deployment)
│   └── assignment2/          # Tài liệu nghiệm thu Task 4 (Traceability, Sprint 1, Oral defense)
├── docker-compose.yml        # Chạy PostgreSQL cục bộ
├── .env.example              # Mẫu biến môi trường
└── README.md
```

## Phần Menu của Võ Minh Tri & Tích hợp Sprint 1 (Khôi)

Task 2–3 đã có API danh sách và chi tiết sản phẩm, gồm dữ liệu size/topping. Menu tải dữ liệu API với loading/empty/error/retry, tìm kiếm không dấu và sắp xếp giá. Cart và thanh toán thuộc phạm vi Sprint 2 (Task 5).

| Thành phần | Địa chỉ phát triển theo mẫu |
| --- | --- |
| Frontend auth | `http://localhost:3001/` |
| Trang Menu | `http://localhost:3001/products` |
| API danh sách công khai | `http://localhost:3002/api/products` |
| PostgreSQL | `localhost:5433`, database `brewlite` |

`/products` là route trang; backend có global prefix `/api`. Frontend đọc `NEXT_PUBLIC_API_URL` có chứa `/api` từ `frontend/.env.local`, dùng chung tại `frontend/src/lib/api.ts`. Menu không cần token. CUSTOMER đăng nhập về `/products`, BARISTA về `/barista/dashboard`. Logout xóa cookie phiên và trạng thái auth rồi về `/`.

## Chạy môi trường phát triển

Cần Node.js/npm tương thích lockfile, Docker Compose hoặc PostgreSQL riêng. Máy kiểm tra dùng Node 20+, Next.js 16, React 19, Prisma.

Từ root, chuẩn bị env nếu file đích chưa có (giữ cấu hình nhóm đang dùng):

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up -d postgres
docker compose ps
```

Đặt `DATABASE_URL` backend trỏ đúng DB, `PORT=3002`, `FRONTEND_ORIGIN=http://localhost:3001`; thay `JWT_SECRET` mẫu bằng secret phát triển. Root `.env` phục vụ Compose và được backend `main.ts` đọc thêm. Prisma CLI trong `backend/` đọc env tại đó; Next.js trong `frontend/` đọc `frontend/.env.local`.

Terminal backend:

```bash
cd backend
npm ci
npx prisma migrate deploy
npm run prisma:generate
npm run prisma:seed
npm run start:dev
```

Lệnh migration trên dành cho DB trống hoặc DB có lịch sử migration tương ứng. Seed 10 UUID ổn định, không xóa dữ liệu; seed lại không nhân đôi Product. Seed không ghi đè tài khoản người dùng hiện có.

Terminal frontend:

```bash
cd frontend
npm ci
npm run dev -- --port 3001
```

Mở `/products`. Khi đổi URL API, restart frontend; bản production cần build lại.

## Kiểm tra API và response

```bash
curl -i http://localhost:3002/api/products
```

Ví dụ cấu trúc thành công:

```json
[
  {
    "id": "31a650c7-8597-4a01-a8e2-000000000001",
    "name": "Bạc xỉu 3 tầng Sài Gòn",
    "price": 29000,
    "imageUrl": "/images/products/sample-milk-coffee.svg"
  }
]
```

Danh sách rỗng: HTTP 200 với `[]`. Query lỗi: HTTP 500 thông báo chung.

Đo benchmark API khi backend sẵn sàng:

```bash
cd backend
node test/products.benchmark.mjs http://localhost:3002/api/products 30
```

## Kiểm thử và tài liệu bàn giao

Frontend:

```bash
cd frontend
node --test tests/*.test.mjs
npm run lint
npm run build
```

Backend:

```bash
cd backend
npm test -- --runInBand
npm run lint
npm run build
```

- [Yêu cầu hệ thống (Task 1)](docs/requirements/srs.md)
- [Bối cảnh và phạm vi (Task 1)](docs/requirements/context-and-scope.md)
- [Thiết kế UML (Task 2)](docs/diagrams/class-domain.puml)
- [Kiến trúc và ADR (Task 3)](docs/architecture/architecture.md)
- [Ma trận kiểm thử US-02/US-03](docs/tri-menu-test-report.md)
- [Bàn giao, Definition of Done và demo](docs/tri-menu-handoff.md)
- [Contract và API](docs/tri-menu-contract.md)
