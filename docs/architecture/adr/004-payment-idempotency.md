# ADR-004 Payment adapter và idempotency

- Trạng thái: Chấp nhận.
- Quyết định: gateway được bọc bởi payment port/adapter; mỗi request có Idempotency-Key duy nhất.
  Transaction A lưu và commit `Payment=PROCESSING` trước khi gọi gateway. Gateway luôn được gọi
  ngoài database transaction. Transaction B cập nhật Payment và gọi Orders lifecycle để cập nhật
  Order/Reservation/stock/history nguyên tử.
- Lý do: retry an toàn, không giữ transaction/lock trong lúc chờ gateway và có thể thay
  mock/gateway mà ít ảnh hưởng domain.
- Bảo vệ database: unique Idempotency-Key; tối đa một Payment PAID và một attempt chưa xác định
  (`PROCESSING`/`UNKNOWN`) trên mỗi Order; constraint kiểm tra outcome đã lưu.
- Trade-off: attempt `PROCESSING` phải được đối soát nếu gateway đã phản hồi nhưng transaction B
  thất bại; phải quản lý thời hạn lưu và job reconciliation khi dùng gateway thật.
