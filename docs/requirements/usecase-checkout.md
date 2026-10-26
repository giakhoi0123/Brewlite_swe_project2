# UC-01 Đặt và thanh toán đơn hàng

## Actor và trigger

- Actor chính: Khách hàng.
- Actor hỗ trợ: Dịch vụ thanh toán mô phỏng.
- Trigger: Khách xác nhận đặt đơn từ giỏ hàng hoặc thử thanh toán lại.

## Tiền điều kiện

- Giỏ có ít nhất một món và cấu hình hợp lệ.
- Dữ liệu sản phẩm tồn tại.
- Khách có JWT hợp lệ hoặc được chuyển sang đăng nhập.

## Hậu điều kiện

- Thành công: Order và Payment là `PAID`; trả mã đơn.
- Bị từ chối trước tạo: không tạo Order/Payment, tồn kho giữ nguyên.
- Thất bại xác định: Order là `PAYMENT_FAILED`, hoàn tồn kho đúng một lần.
- Chưa xác định: Order giữ `PENDING` để đối soát, không tự tạo giao dịch mới.

## Luồng chính

1. Kiểm tra JWT và hiển thị checkout.
2. Khách chọn `WALLET` hoặc `CARD`.
3. UI khóa nút và gửi giỏ hàng.
4. Backend tính lại giá và kiểm tra promotion.
5. Transaction giữ tồn kho, tạo Order `PENDING` và OrderItem snapshot.
6. UI gửi payment cùng `Idempotency-Key`.
7. Backend kiểm tra chủ sở hữu và khóa chống lặp, lưu Payment `PROCESSING`.
8. Gateway trả `PAID`.
9. Transaction cập nhật Payment/Order thành `PAID`.
10. UI xóa giỏ, hiển thị mã đơn và cho theo dõi.

## Nhánh bắt buộc

- A01: chưa đăng nhập/hết phiên.
- A02: thử thanh toán lại bằng cùng orderId và khóa mới.
- A03: cùng Idempotency-Key trả lại kết quả cũ.
- E01: dữ liệu sai hoặc giả mạo, trả 400.
- E02: hết hàng/xung đột, trả 409 và rollback.
- E03: lỗi database, rollback.
- E04: lỗi xác thực/phân quyền, trả 401/403.
- E05: khóa thanh toán xung đột hoặc đơn đã thanh toán.
- E06: timeout/UNKNOWN, giữ `PENDING` để đối soát.

## Truy vết

FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, NFR-02 và NFR-04.
