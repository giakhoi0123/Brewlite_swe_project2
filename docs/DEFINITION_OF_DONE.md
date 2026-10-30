# Definition of Done (DoD) — BrewLite

Quy định hoàn thành công việc bắt buộc áp dụng cho toàn bộ các thành viên và module trong dự án BrewLite. Một task hoặc Pull Request chỉ được coi là **DONE** và đủ điều kiện merge vào nhánh `main` khi thỏa mãn đầy đủ 10 tiêu chí sau:

1. **Hoàn thành đúng User Story / FR:** Mã nguồn đáp ứng chính xác tiêu chí chấp nhận của User Story và Yêu cầu chức năng tương ứng được quy định trong tài liệu Task 1 (SRS và Bối cảnh & Phạm vi).
2. **Tuân thủ mô hình UML:** Hiện thực đúng cấu trúc và hành vi được mô tả trong các sơ đồ Use Case, Activity, Sequence và Class Diagram tương ứng của Task 2.
3. **Tuân thủ kiến trúc chốt ở Task 3:** Giữ vững cấu trúc Modular Monolith (ADR-002) và Monorepo (ADR-001); tôn trọng ranh giới giữa các module; không để frontend truy vấn trực tiếp cơ sở dữ liệu.
4. **Có kiểm thử tương ứng:** Bổ sung unit tests và integration tests bao phủ cả trường hợp hợp lệ (happy path) và các kịch bản lỗi biên (edge cases/error handling).
5. **Không có lỗi lint và build:** Toàn bộ mã nguồn vượt qua linter không có lỗi/cảnh báo (`npm run lint`) và biên dịch production thành công (`npm run build`).
6. **Không có secrets trong Git:** Không commit file `.env`, mật khẩu, JWT secret hoặc khóa API; chỉ sử dụng `.env.example` với giá trị giữ chỗ an toàn.
7. **Có Pull Request và review:** Mọi thay đổi phải đi qua Pull Request từ branch riêng vào `main`, sử dụng đúng mẫu `PULL_REQUEST_TEMPLATE.md` và có ít nhất 1 thành viên review, chấp thuận trước khi merge.
8. **CI hoàn thành các quality gate áp dụng được:** Pipeline Continuous Integration (Install → Lint → Unit Test → Build) thực thi và vượt qua toàn bộ các bước kiểm tra áp dụng được.
9. **Không phá vỡ module của thành viên khác:** Các thay đổi không làm ảnh hưởng tiêu cực, không phá hỏng API contracts hoặc làm gián đoạn luồng làm việc của các module khác.
10. **Có bằng chứng thực tế trước khi đánh dấu DONE:** Có kết quả log kiểm thử, kết quả chạy build hoặc minh chứng cụ thể xác nhận chức năng hoạt động đúng trước khi ghi nhận hoàn thành.

