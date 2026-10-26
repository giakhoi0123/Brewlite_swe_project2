# ADR-003 Giá phía server và transaction tồn kho

- Trạng thái: Chấp nhận.
- Quyết định: backend tính lại giá; tạo đơn và giữ tồn kho trong transaction ngắn.
- Lý do: ngăn giả mạo giá và bán vượt tồn.
- Trade-off: khóa có thể gây tranh chấp; cần integration test đồng thời.
