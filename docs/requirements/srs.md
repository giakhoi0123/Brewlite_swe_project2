# BrewLite Assignment 2 SRS rút gọn

## Yêu cầu chức năng

| Mã | Mô tả | MoSCoW | Tiêu chí chấp nhận chính |
|---|---|---|---|
| FR-01 | Menu và tìm kiếm | Must | API trả tên, giá, ảnh, trạng thái; tìm không phân biệt hoa thường; UI có loading, empty, error. |
| FR-02 | Chi tiết và giỏ hàng | Must | Chỉ nhận size/topping hợp lệ; thêm, sửa, xóa và tính tổng đúng. |
| FR-03 | Tài khoản và quyền | Must | Mật khẩu được băm; API trả 401 khi JWT sai và 403 khi sai role. |
| FR-04 | Tạo đơn | Must | Backend tính lại giá; tạo Order PENDING và OrderItem snapshot trong transaction. |
| FR-05 | Thanh toán mô phỏng | Must | Hỗ trợ WALLET/CARD; cùng Idempotency-Key không ghi nhận hai lần. |
| FR-06 | Xác nhận, lịch sử và theo dõi | Must | Khách nhận mã đơn và chỉ xem đơn của chính mình. |
| FR-07 | Vòng đời và tồn kho | Must | Tồn kho không âm; chuyển trạng thái sai bị từ chối. |
| FR-08 | Khuyến mãi | Should | Chỉ áp dụng mã hợp lệ, còn hạn và đủ điều kiện. |
| FR-09 | Tích điểm | Could | Chỉ cộng điểm một lần sau thanh toán thành công. |
| FR-10 | Barista | Could | Barista xem hàng đợi và cập nhật trạng thái; khách không gọi được API này. |

## Yêu cầu phi chức năng

| Mã | Thuộc tính | MoSCoW | Tiêu chí chấp nhận chính |
|---|---|---|---|
| NFR-01 | Hiệu năng | Should | P95 đọc menu không quá 2 giây với 50 request đồng thời trong dữ liệu demo. |
| NFR-02 | Bảo mật | Must | Hash mật khẩu, JWT/RBAC ở backend, secret không có trong repo/log. |
| NFR-03 | Khả dụng | Should | `/health` trả 200 khi sẵn sàng; UI có lỗi và retry. |
| NFR-04 | Toàn vẹn | Must | Transaction, tồn kho không âm và retry không tạo dữ liệu trùng. |
| NFR-05 | Triển khai | Must | Có thể chạy bằng README và Docker Compose mà không sửa source. |
| NFR-06 | Khả dụng giao diện | Should | Không tràn ngang ở 360 px; nút có disable/loading. |
| NFR-07 | Bảo trì | Should | Thay đổi API/schema đi kèm contract, migration, test và docs. |
