# Kiến trúc BrewLite

BrewLite dùng kiến trúc phân lớp và modular monolith cho NestJS.

## Thành phần

- Next.js/PWA: menu, chi tiết, giỏ, checkout, lịch sử và Barista UI.
- NestJS API: Auth, Products, Orders, Payments, Promotions, Loyalty, Barista và Health.
- PostgreSQL: migration, seed, transaction, unique constraint và persistent storage.
- Payment adapter: chuẩn hóa kết quả PAID, FAILED và UNKNOWN.
- Vận hành: Docker, environment variables, `/health` và structured logs.

## Quy tắc phụ thuộc

UI chỉ gọi API. Controller gọi application service. Application service dùng repository và payment port. Infrastructure cài đặt repository/adapter. Domain không phụ thuộc giao diện.
