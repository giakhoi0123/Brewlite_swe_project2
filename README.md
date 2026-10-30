# Brewlite_swe_project2

## Git Workflow & Contribution

Quy chuẩn làm việc và đóng góp mã nguồn của nhóm BrewLite:

- **Nhánh riêng theo task:** Mỗi thành viên phát triển trên branch riêng được đặt tên theo module hoặc task (ví dụ: `feature/task4-khoi-sprint1`, `feature/products-api`).
- **Không làm việc trực tiếp trên main:** Tuyệt đối không commit hoặc push trực tiếp lên nhánh `main`. Không force push nhánh `main`.
- **Conventional Commits:** Đặt thông điệp commit theo chuẩn Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`). Mỗi commit phản ánh đúng một thay đổi thực tế.
- **Tích hợp qua Pull Request:** Mọi thay đổi đều phải tạo Pull Request vào `main` và sử dụng mẫu tại `.github/PULL_REQUEST_TEMPLATE.md`.
- **Kiểm tra CI & Code Review:** Bắt buộc vượt qua các bước kiểm tra tự động của CI và có sự xem xét, chấp thuận của thành viên khác trước khi merge.
- **Bảo toàn lịch sử:** Không thay đổi tác giả hoặc thời gian commit; giữ tính toàn vẹn và minh bạch của lịch sử Git.
- **Tôn trọng phân công:** Không tự ý viết code thay cho phần việc của thành viên khác.
- **Dọn dẹp branch:** Xóa branch tính năng sau khi merge thành công và đã xác minh an toàn trên `main`.
- **Quy định hoàn thành:** Tuân thủ đầy đủ 10 tiêu chí nghiệm thu tại [docs/DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md).
