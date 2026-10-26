# ADR-004 Payment adapter và idempotency

- Trạng thái: Chấp nhận.
- Quyết định: gateway được bọc bởi payment port/adapter; mỗi request có Idempotency-Key duy nhất.
- Lý do: retry an toàn và có thể thay mock/gateway mà ít ảnh hưởng domain.
- Trade-off: phải lưu kết quả, phát hiện khóa xung đột và quản lý thời hạn lưu.
