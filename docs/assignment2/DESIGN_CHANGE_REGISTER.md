# 📝 Sổ Đăng Ký Thay Đổi Thiết Kế (Design Change Register)

**Dự án:** BrewLite — Hệ thống đặt cà phê trực tuyến  
**Môn học:** Công nghệ phần mềm (SWE) — Đại học Sài Gòn  
**Người lập bảng:** Phạm Gia Khôi — Trưởng nhóm, phụ trách tích hợp & quy trình  
**Mục đích:** Ghi nhận minh bạch, đánh giá tác động và theo dõi trạng thái phê duyệt của các sai khác giữa tài liệu thiết kế ban đầu (Task 1–3) và mã nguồn thực tế triển khai (Task 4–5).

---

## 1. Nguyên tắc quản lý thay đổi thiết kế

1. **Tuyệt đối không âm thầm sửa code hoặc sửa sơ đồ:** Mọi thay đổi kỹ thuật phát sinh trong quá trình triển khai đều phải được lập hồ sơ tại Sổ đăng ký này.
2. **Bảo toàn thiết kế gốc:** Giữ nguyên các sơ đồ `.puml` và tài liệu SRS ban đầu để giảng viên đối chiếu quá trình tiến hóa của phần mềm.
3. **Phân định rõ thẩm quyền:** Các thay đổi mức hệ thống cần sự thống nhất của cả nhóm và xác nhận của Giảng viên hướng dẫn.

---

## 2. Bảng đăng ký thay đổi thiết kế (Change Log)

| Mã CR | Hạng mục thay đổi | Thiết kế ban đầu (Task 1–3) | Hiện thực trong Code (Task 4) | Lý do kỹ thuật & Bối cảnh | Tác động (Impact) | Task liên quan | Người đề xuất / Reviewer | Trạng thái phê duyệt |
|---|---|---|---|---|---|---|---|---|
| **DCR-01** | Cấu trúc thư mục Monorepo | Đề bài mẫu và một số tài liệu Task 1 dùng `apps/web`, `apps/api`. | Sử dụng `frontend/` (Next.js) và `backend/` (NestJS). | Nhóm đã thống nhất từ Sprint 0 và lập quyết định kiến trúc tại **ADR-001 (Monorepo)** nhằm đơn giản hóa cấu trúc workspace, tương thích tối đa với công cụ npm workspace và Next.js / NestJS CLI độc lập. | Không ảnh hưởng kiến trúc logic; chỉ khác biệt về đường dẫn vật lý. CI pipeline trỏ trực tiếp vào thư mục tương ứng. | Task 3, Task 4.1 | Điệp / Khôi | **ĐÃ PHÊ DUYỆT (Nhóm thông qua qua ADR-001)** |
| **DCR-02** | Kiểu dữ liệu đơn giá tiền tệ | Trong Class Diagram (`class-domain.puml`), thuộc tính giá là `Decimal basePrice`. | Trong Prisma schema và TypeScript contract, thuộc tính là `Int price` (đơn vị: đồng VND). | Đơn vị tiền tệ Việt Nam (VND) không sử dụng số thập phân (xu/hào). Việc dùng kiểu số nguyên 32-bit (`Int` trong Prisma/PostgreSQL, `number` trong JS) loại bỏ hoàn toàn rủi ro sai số dấu phẩy động (floating-point precision error) và tối ưu hóa tốc độ tính toán số học trên server. | Dữ liệu trả về qua API là số nguyên nguyên bản (`29000`), frontend dùng `Intl.NumberFormat('vi-VN')` để format hiển thị (`29.000 ₫`). | Task 2, Task 4.3 | Trí / Khôi | **ĐÃ PHÊ DUYỆT (Hợp đồng TRI-01)** |
| **DCR-03** | Trường dữ liệu của API Danh sách (`GET /api/products`) | Một số yêu cầu ban đầu đề cập API trả về cả `stock` và `description`. | `GET /api/products` chỉ trả 4 trường: `id`, `name`, `price`, `imageUrl`. `description`, `sizes`, `toppings` được cung cấp qua `GET /api/products/:id`. | Theo chuẩn thiết kế Catalog RESTful (TRI-01/TRI-03), endpoint danh sách cần tối ưu payload (payload size nhỏ, P95 < 500ms). Tránh rò rỉ thông tin tồn kho thực tế của quán cho đối thủ quét dữ liệu (scraping). Tồn kho (`stock`) được lưu trong database để phục vụ kiểm tra và khóa hàng (optimistic concurrency) ở backend khi checkout (Sprint 2). | Frontend Menu tải nhanh, chi tiết món chỉ nạp khi khách nhấn xem món. Phù hợp NFR-01 (Hiệu năng). | Task 1, Task 4.3 | Trí / Khôi | **ĐÃ PHÊ DUYỆT (Hợp đồng TRI-01 & TRI-03)** |
| **DCR-04** | Phương thức thanh toán (Payment Gateway) | Use Case, Activity và Sequence Diagram Task 2 đặc tả thanh toán `WALLET` / `CARD`. | Đang định hướng tích hợp cổng thanh toán thực tế **VNPAY Sandbox** theo gợi ý cập nhật mới từ Giảng viên. | Giảng viên hướng dẫn định hướng kiểm chứng quy trình thanh toán qua môi trường sandbox ngân hàng/VNPAY thay vì chỉ mock nội bộ hoàn toàn. | **Phạm vi thuộc Sprint 2 (Task 5).** Không làm thay đổi phạm vi Task 4 (Sprint 1 chỉ nghiệm thu Menu MVP). Sequence Task 2 vẫn giữ nguyên nhánh mô phỏng để bảo toàn tài liệu nộp đợt 1. | Task 2, Task 5 | Khôi / Toàn nhóm | **ĐỀ XUẤT CHO TASK 5 (Chờ nghiệm thu Sprint 2)** |
| **DCR-05** | Phân định ranh giới chức năng Sprint 1 vs Sprint 2 | Toàn bộ Use Case đặt hàng (UC-01) bao gồm chọn món, giỏ hàng, checkout, thanh toán, barista. | Sprint 1 (Task 4) chỉ triển khai lát cắt **Menu & Catalog MVP** (FR-01, FR-02 xem chi tiết). Cart, Checkout, VNPAY, Loyalty thuộc Sprint 2 (Task 5). | Áp dụng nguyên lý phát triển phần mềm Agile/Scrum: chia nhỏ backlog theo sprint khả thi. Nút "Chọn món" mở modal xem cấu hình chi tiết (size/topping/giá) và ghi rõ thông báo chuyển tiếp giỏ hàng sang Sprint 2. | Giữ vững tiến độ Sprint 1, bàn giao sản phẩm có thể chạy được (working software) mà không bị dở dang. | Task 4, Task 5 | Khôi / Nhóm | **ĐÃ PHÊ DUYỆT (Kế hoạch phân công môn học)** |

---

## 3. Kết luận và Hướng xử lý tiếp theo

- Mọi sai biệt giữa bản vẽ UML và code thực tế đều có lý do kỹ thuật chính đáng (kỹ thuật tiền tệ VND, tối ưu hóa payload RESTful, kiến trúc monorepo gọn nhẹ).
- Đối với vấn đề thanh toán VNPAY Sandbox (DCR-04), nhóm giữ nguyên tài liệu UML gốc của Task 2 và sẽ bổ sung sơ đồ chuyển đổi (Architecture Evolution / Adapter Diagram) riêng trong báo cáo Task 5.

