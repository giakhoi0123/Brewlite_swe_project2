# 🎙️ Tài Liệu Chuẩn Bị Vấn Đáp & Bảo Vệ Task 4 Trước Giảng Viên
## Phụ trách: Phạm Gia Khôi — Trưởng nhóm, Tích hợp hệ thống & CI

---

## 🎯 PHẦN 1: KỊCH BẢN DEMO 5–7 PHÚT CHO GIẢNG VIÊN

| Phút | Nội dung trình bày | Thao tác trên máy | Điểm nhấn kỹ thuật cần nói |
|---|---|---|---|
| **00:00 - 01:00** | **Giới thiệu bối cảnh & Tính nhất quán (Task 1 → Task 3)** | Mở `docs/requirements/srs.md` và `docs/diagrams/usecase-tongquat.puml` | *"Thưa Thầy/Cô, nhóm thực hiện đúng quy trình Software Engineering. Bắt đầu từ Task 1 với yêu cầu FR-01 (Menu) và FR-02 (Chi tiết món). Tại Task 2, nhóm mô hình hóa thành Use Case `UC_Menu`, `UC_Detail` và Class `Product`, `ProductOption`. Tại Task 3, nhóm chọn kiến trúc Monorepo (ADR-001) và Modular Monolith (ADR-002)."* |
| **01:00 - 02:30** | **Demo giao diện Menu & Tính năng Sprint 1 (Task 4)** | Mở trình duyệt tại `http://localhost:3001/products` (hoặc mở code demo) | 1. **Duyệt thực đơn:** Hiển thị danh sách món với tên, ảnh SVG fallback, giá định dạng VND.<br/>2. **Tìm kiếm:** Gõ từ khóa tiếng Việt không dấu (ví dụ: `bac xiu`, `ca phe`), kết quả lọc ngay tức thì không cần gửi query thừa lên server.<br/>3. **Sắp xếp:** Đổi sắp xếp giá tăng dần / giảm dần.<br/>4. **Chi tiết món:** Nhấn "Chọn món" trên một thẻ, modal chi tiết mở ra, hiển thị các size S/M/L kèm phụ phí và topping kèm phụ phí, tổng tiền tự động nhảy. Giải thích rõ ranh giới: Chưa thêm vào giỏ vì giỏ hàng thuộc Sprint 2. |
| **02:30 - 03:30** | **Đối chiếu Kiến trúc & Source Code thực tế** | Mở VS Code: `products.controller.ts`, `products.service.ts`, `schema.prisma`, `product-catalog.tsx` | *"Đây là luồng thực tế: Next.js Component gọi fetcher trong `frontend/src/lib/products.ts` → gửi REST API đến NestJS Controller `ProductsController` → gọi `ProductsService` → dùng Prisma Client truy vấn bảng `products` trong PostgreSQL. Tuyệt đối không hardcode dữ liệu vào UI, không để UI gọi trực tiếp DB."* |
| **03:30 - 04:30** | **Minh chứng Kiểm thử tự động (Quality Gate)** | Mở terminal chạy `npm test` ở frontend và backend | *"Nhóm sở hữu 51 bài test tự động bao phủ cả backend và frontend: kiểm tra hợp đồng dữ liệu, kiểm tra các nhánh lỗi 400 (sai UUID), 404 (không tìm thấy), 500 (lỗi DB bảo mật), kiểm tra normalize tìm kiếm tiếng Việt. Toàn bộ 51 bài test đều PASS 100%."* |
| **04:30 - 05:30** | **Minh chứng CI/CD & Quy trình Git** | Mở file `.github/workflows/ci.yml` và `docs/assignment2/DEFINITION_OF_DONE.md` | *"Mọi commit và Pull Request đều được kiểm soát bởi GitHub Actions theo đúng 4 bước tuần tự: INSTALL → LINT → UNIT TEST → BUILD. Nếu có lỗi typecheck hoặc test fail, CI sẽ chặn không cho merge vào main. Nhóm tuân thủ 10 tiêu chí Definition of Done."* |
| **05:30 - 06:30** | **Quy trình quản lý thay đổi (Traceability & Change Register)** | Mở `TASK4_KHOI_TRACEABILITY.md` và `DESIGN_CHANGE_REGISTER.md` | *"Mọi sai khác giữa thiết kế ban đầu và code (như folder `frontend/`/`backend/`, kiểu số nguyên VND thay cho float, hoặc phạm vi tách Sprint) đều được nhóm ghi chép minh bạch tại Sổ đăng ký thay đổi thiết kế DCR-01 đến DCR-05, không tự tiện sửa tài liệu."* |

---

## 📚 PHẦN 2: TRẢ LỜI 18 CÂU HỎI VẤN ĐÁP KỸ THUẬT TỪ SOURCE CODE

### 1. Tại sao nhóm chọn kiến trúc Monorepo?
- **Trả lời:** Theo quyết định kiến trúc **ADR-001**, dự án môn học cần sự gắn kết chặt chẽ giữa tài liệu thiết kế (Task 1–3), mã nguồn backend, frontend và hạ tầng CI/Docker trong cùng một lịch sử commit.
- **Lợi ích:** Dễ dàng truy vết (traceability) từ yêu cầu đến code; đồng bộ hóa hợp đồng API (DTO/types) giữa frontend và backend; một Pull Request có thể chứa cả thay đổi API và thay đổi UI tương ứng mà không phải quản lý nhiều repo rời rạc.
- **Minh chứng:** Cấu trúc gốc gồm `backend/`, `frontend/`, `docs/`, `docker-compose.yml`.

### 2. Tại sao frontend chọn Next.js (App Router)?
- **Trả lời:** Next.js hỗ trợ Hybrid Rendering (Server Components và Client Components), tối ưu hóa SEO và tốc độ tải trang ban đầu. Next.js có hệ thống định tuyến file-system trực quan (`src/app/products/page.tsx`), hỗ trợ TypeScript chuẩn mực và tích hợp sẵn Turbopack giúp biên dịch cực nhanh trong môi trường phát triển.
- **Minh chứng:** `frontend/src/app/products/page.tsx` đóng vai trò Server Component cung cấp metadata và khung shell, trong khi `ProductCatalog` và `ProductDetailModal` là Client Components tương tác.

### 3. Tại sao backend chọn NestJS?
- **Trả lời:** Đề bài bắt buộc sử dụng NestJS. Về mặt kỹ thuật, NestJS cung cấp một kiến trúc chuẩn doanh nghiệp (Enterprise Architecture) dựa trên TypeScript, áp dụng Dependency Injection (DI), Decorators, và Module hóa mạnh mẽ, giúp code backend có tổ chức ngăn nắp, dễ viết unit test và cô lập module tốt hơn so với Express thuần.
- **Minh chứng:** `ProductsModule` trong `backend/src/products/products.module.ts` gói gọn Controller và Service, chỉ import `PrismaModule` dùng chung.

### 4. Vì sao nhóm sử dụng Modular Monolith cho Backend?
- **Trả lời:** Theo **ADR-002**, đối với quy mô hệ thống BrewLite, kiến trúc Modular Monolith là lựa chọn tối ưu nhất so với Microservices:
  - Tránh được độ phức tạp về mạng, phân tán dữ liệu và distributed transaction.
  - Vẫn đảm bảo tính module hóa cao (Auth, Products, Orders, Payments độc lập trong từng thư mục của `backend/src/`).
  - Hỗ trợ transaction trực tiếp trên cùng một PostgreSQL database, cực kỳ quan trọng cho tính nhất quán khi kiểm tra tồn kho và tạo đơn hàng.

### 5. Dữ liệu thực đơn (Menu) lấy từ đâu?
- **Trả lời:** Dữ liệu thực đơn được lưu trữ bền vững trong cơ sở dữ liệu **PostgreSQL 15** thông qua ORM **Prisma**. Khi backend khởi động, script seed `backend/prisma/seed-products.ts` và `seed-product-customization.ts` sẽ nạp 10 sản phẩm cà phê mẫu chuẩn cùng các tùy chọn kích cỡ (S, M, L) và topping. Frontend hoàn toàn lấy dữ liệu thông qua REST API `GET /api/products`, không có dữ liệu hardcode trên giao diện.

### 6. Khi người dùng tải trang Menu, request đi qua các lớp nào?
- **Trả lời:** Request tuân thủ nghiêm ngặt mô hình phân tầng:
  1. Trình duyệt gọi route `/products` của Next.js.
  2. Client component kích hoạt `useEffect` gọi hàm `fetchProducts()` trong `frontend/src/lib/products.ts`.
  3. Hàm này gửi HTTP GET request `http://localhost:3002/api/products`.
  4. NestJS tiếp nhận request tại `ProductsController.findAll()`.
  5. Controller ủy quyền cho `ProductsService.findAll()`.
  6. Service dùng `PrismaService.product.findMany()` thực thi câu truy vấn SQL `SELECT id, name, price, image_url FROM products ORDER BY name ASC, id ASC`.
  7. PostgreSQL trả dữ liệu về Prisma Client → Service → Controller → HTTP Response (JSON) → Frontend nhận dữ liệu, parse contract (`parseProducts`) và render vào `ProductGrid`.

### 7. Lớp `Product` trong Class Diagram ánh xạ tới Prisma như thế nào?
- **Trả lời:**
  - Trong `class-domain.puml`: `Product` có các thuộc tính `id: UUID`, `name: String`, `basePrice: Decimal`, `imageUrl: String`, `isAvailable: Boolean`.
  - Trong `backend/prisma/schema.prisma`:
    - `id String @id @default(uuid()) @db.Uuid`: Ánh xạ đúng UUID.
    - `name String`: Chuỗi tên món.
    - `price Int`: Ánh xạ `basePrice` sang đơn vị số nguyên VND để tránh sai số dấu phẩy động (đã ghi nhận tại DCR-02).
    - `imageUrl String @map("image_url")`: Đường dẫn ảnh sản phẩm.
    - `stock Int @default(0)`: Quản lý số lượng tồn kho thực tế.
    - Quan hệ `Product 1 -- 0..* ProductOption` được ánh xạ thành quan hệ 1-N với `ProductSize` và `ProductTopping`.

### 8. Vì sao hệ thống cần DTO và API Contract?
- **Trả lời:**
  - **Bảo mật và toàn vẹn dữ liệu:** DTO (Data Transfer Object) và ValidationPipe (như `ParseUUIDPipe` trong `ProductsController`) giúp xác thực định dạng dữ liệu ngay tại cửa ngõ API trước khi chạm vào tầng nghiệp vụ hoặc CSDL, ngăn chặn SQL Injection và dữ liệu rác.
  - **Độc lập giữa các tầng:** API Contract quy định rõ cấu trúc JSON trả về (ví dụ: mảng phẳng 4 trường cho danh sách). Khi database schema thay đổi (ví dụ thêm cột nội bộ), chỉ cần sửa tầng Service mapping mà không làm gãy giao diện Frontend.

### 9. Nếu Backend bị lỗi hoặc trả về HTTP 500, Frontend xử lý thế nào?
- **Trả lời:**
  - Frontend áp dụng State Machine trong `ProductCatalog.tsx`: gồm 4 trạng thái `loading`, `success`, `empty`, `error`.
  - Khi API trả về mã lỗi (`!response.ok`), fetcher ném ngoại lệ `Error("Unable to load products")`, chuyển trạng thái component sang `error`.
  - Giao diện hiển thị khối thông báo lỗi chuẩn với thuộc tính trợ năng `role="alert"`, màu cảnh báo và **nút "Thử lại" (Retry)**. Khi người dùng nhấn nút, hàm `retry()` sẽ tăng biến đếm `attempt`, kích hoạt lại `useEffect` để tái kết nối API mà không cần người dùng phải F5 tải lại toàn bộ trang web.

### 10. Nếu CSDL không có sản phẩm nào thì giao diện hiển thị gì?
- **Trả lời:**
  - Backend trả về HTTP 200 với mảng rỗng `[]` (đã được kiểm chứng trong bài test `products.http.spec.ts`).
  - Frontend kiểm tra `products.length === 0`, chuyển trạng thái sang `empty`.
  - Giao diện hiển thị vùng Empty State với thông điệp: *"Thực đơn chưa có đồ uống. Bạn hãy quay lại sau để khám phá những món mới của BrewLite nhé"*, hoàn toàn không báo lỗi sập hay màn hình trắng.

### 11. Làm sao nhóm chứng minh hệ thống không dùng Mock data khi tích hợp?
- **Trả lời:**
  - Trong code Frontend (`frontend/src/lib/products.ts`), hàm `fetchProducts()` thực hiện lệnh gọi mạng thực tế `fetch(`${API_BASE_URL}/products`)` với cấu hình `cache: "no-store"` và `credentials: "omit"`.
  - Trong Backend, `ProductsService` tiêm `PrismaService` thật để query vào PostgreSQL qua `this.prisma.product.findMany()`.
  - Nếu tắt backend hoặc ngắt kết nối mạng, trang web lập tức hiển thị Error State và nút Thử lại. Khi kết nối lại, dữ liệu thật từ cơ sở dữ liệu xuất hiện ngay lập tức. Dữ liệu mock chỉ tồn tại trong các file test độc lập (`*.spec.ts`, `fixtures/`) phục vụ kiểm thử đơn vị.

### 12. Vì sao dự án cần cả Unit Test và API/Integration Test?
- **Trả lời:**
  - **Unit Test:** Kiểm tra các hàm logic biệt lập mà không cần khởi động server hay database (ví dụ: `product-filters.test.mjs` kiểm tra thuật toán chuẩn hóa tiếng Việt, tách dấu và sắp xếp; `product-contract.test.mjs` kiểm tra hàm parse dữ liệu).
  - **API/Integration Test:** Kiểm tra sự tương tác giữa các thành phần phần mềm (ví dụ: `products.http.spec.ts` dùng Supertest kiểm tra NestJS routing, pipe validation, CORS headers và exception filter khi có request HTTP thật gửi đến).
  - Cả hai kết hợp tạo nên mạng lưới bảo vệ chất lượng đa tầng (Defense in Depth).

### 13. Vì sao CI Pipeline phải theo thứ tự INSTALL → LINT → UNIT TEST → BUILD?
- **Trả lời:**
  - Đây là nguyên tắc "Fail Fast, Fail Cheap" trong Kỹ nghệ phần mềm:
    1. **INSTALL:** Phải cài đặt đúng dependencies theo lockfile (`npm ci`) trước tiên; nếu dependency lỗi thì không thể làm gì tiếp.
    2. **LINT:** Kiểm tra lỗi cú pháp, quy chuẩn viết code và các lỗi tiềm ẩn nhanh nhất (chỉ mất vài mili-giây). Nếu sai quy chuẩn, dừng ngay lập tức.
    3. **UNIT TEST:** Chạy các bài kiểm thử logic nghiệp vụ. Nếu nghiệp vụ sai, không lãng phí tài nguyên để build.
    4. **BUILD:** Bước tốn nhiều thời gian và CPU nhất (biên dịch TypeScript, bundle mã nguồn). Chỉ chạy khi code đã sạch lint và vượt qua toàn bộ bài test.

### 14. Pull Request giúp kiểm soát chất lượng phần mềm như thế nào?
- **Trả lời:**
  - **Ngăn chặn lỗi đơn lẻ:** Không ai được commit trực tiếp vào `main`. Mọi thay đổi đều được cô lập trên branch tính năng.
  - **Tự động hóa Quality Gate:** GitHub Actions CI tự động chạy trên mỗi PR. Nếu có lỗi, nút Merge sẽ bị khóa cứng.
  - **Đồng nghiệp thẩm định (Peer Review):** Thành viên khác đọc code qua PR template, kiểm tra xem code có bám sát thiết kế UML và tiêu chí DoD hay không trước khi bấm phê duyệt.

### 15. Một yêu cầu như FR-01 được truy vết đến bài test bằng cách nào?
- **Trả lời:**
  - Thông qua **Ma trận truy vết (Traceability Matrix)**:
    - Yêu cầu: **FR-01** (Menu và tìm kiếm).
    - Use Case: `UC_Menu` trong `usecase-tongquat.puml`.
    - Class: `Product` trong `class-domain.puml`.
    - Code Backend: `ProductsController.findAll()` và `ProductsService.findAll()`.
    - Code Frontend: `ProductCatalog.tsx` và `product-filters.ts`.
    - Bài test kiểm chứng:
      - `products.http.spec.ts` (kiểm chứng API trả đúng 4 trường theo contract).
      - `product-filters.test.mjs` (kiểm chứng tìm kiếm tiếng Việt và sắp xếp giá).
      - `menu-integration.test.mjs` (kiểm chứng tích hợp HTTP 200, empty và error).

### 16. Những chức năng nào bắt buộc phải để sang Task 5 (Sprint 2)?
- **Trả lời:**
  - Giỏ hàng (Cart Store, tính tổng tiền giỏ hàng).
  - Đặt hàng: Tạo đơn hàng `Order` với trạng thái `PENDING` và snapshot `OrderItem` trong database transaction.
  - Thanh toán: Gửi `POST /api/payments` kèm `Idempotency-Key` kết nối cổng VNPAY Sandbox.
  - Quản lý tồn kho: Trừ tồn kho và hoàn tồn kho khi thanh toán thất bại.
  - Màn hình quản lý hàng đợi và cập nhật trạng thái đơn của Barista.
  - Lý do: Đây là các chức năng thuộc luồng giao dịch tài chính và vận hành đơn, thuộc phạm vi Sprint 2 theo phân công môn học.

### 17. Tại sao cấu trúc thư mục thực tế lại dùng `frontend/`, `backend/` thay vì `apps/web`, `apps/api` như trong đề bài?
- **Trả lời:**
  - Nhóm đã thống nhất và ghi nhận quyết định kiến trúc tại **ADR-001 (Monorepo)** và Sổ đăng ký thay đổi thiết kế **DCR-01**.
  - Việc đặt tên `frontend/` và `backend/` thể hiện trực quan ranh giới giữa hai ứng dụng độc lập, tương thích mượt mà với CLI gốc của Next.js và NestJS mà không cần cấu hình phức tạp của Turborepo/Nx, phù hợp với quy mô dự án và môi trường local của sinh viên.

### 18. Nếu mã nguồn thực tế khác với sơ đồ UML thì nhóm xử lý thế nào?
- **Trả lời:**
  - Nhóm tuyệt đối không tự ý vẽ lại sơ đồ để "hợp thức hóa" code một cách tùy tiện, cũng không phá vỡ logic đang chạy tốt.
  - Nhóm lập hồ sơ tại **Sổ đăng ký thay đổi thiết kế (Design Change Register — `DESIGN_CHANGE_REGISTER.md`)**, nêu rõ: Thiết kế ban đầu là gì, Hiện thực trong code là gì, Lý do kỹ thuật tại sao phải thay đổi (ví dụ: dùng số nguyên VND để tránh sai số float), Tác động đến hệ thống ra sao và ai là người đề xuất/phê duyệt. Đây là quy trình chuẩn mực trong ngành công nghệ phần mềm chuyên nghiệp.
