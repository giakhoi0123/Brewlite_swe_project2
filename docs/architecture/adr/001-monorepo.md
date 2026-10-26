# ADR-001 Monorepo

- Trạng thái: Chấp nhận.
- Quyết định: dùng một repository gồm `apps/web`, `apps/api` và `docs`.
- Lý do: dễ truy vết yêu cầu, sơ đồ, code, test và CI trong cùng lịch sử.
- Trade-off: pipeline có thể lâu hơn; cần cache và lọc job theo đường dẫn.
