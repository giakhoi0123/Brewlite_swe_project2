# ADR-005 Container và nền tảng production

- Trạng thái: Đề xuất, chưa chốt nền tảng.
- Quyết định dự kiến: container hóa API; quản lý secret ngoài source; có health check, migration và smoke test.
- Lý do: môi trường tái tạo được và phù hợp CI/CD.
- Việc cần chốt: nền tảng web/API, PostgreSQL, container registry, log, volume, rollback và chi phí.
