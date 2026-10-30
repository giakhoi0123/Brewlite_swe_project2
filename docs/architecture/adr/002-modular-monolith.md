# ADR-002 NestJS modular monolith và PostgreSQL

- Trạng thái: Chấp nhận.
- Quyết định: backend là modular monolith, dữ liệu chung trong PostgreSQL và quản lý bằng migration.
- Lý do: phù hợp quy mô Assignment 2 và hỗ trợ transaction đơn hàng/tồn kho.
- Trade-off: không scale từng module độc lập; phải kiểm soát phụ thuộc chéo.
