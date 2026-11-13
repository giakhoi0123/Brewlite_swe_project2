# Sprint Retrospective — BrewLite Project

- **Sprint:** Final Release Sprint (v1.0.0)
- **Date:** 2026-11-13
- **Production URL:** https://brewlite.duckdns.org
- **Demo Video:** https://drive.google.com/file/d/1uwnyQYlfJe3_WLpb97oH4A49crlGU_pa/view?usp=drive_link

## 1. What Went Well (Điểm làm tốt)
- **End-to-End Business Flow:** Hoàn thiện thông suốt luồng nghiệp vụ cốt lõi từ đặt món, áp mã khuyến mãi (`HELLOBREW`), thanh toán VNPay Sandbox, theo dõi lịch sử trạng thái đơn hàng (`PENDING` $\rightarrow$ `PAID` $\rightarrow$ `COMPLETED`) đến tích điểm tự động Loyalty.
- **Cross-Team Coordination:** Phối hợp xử lý nhanh các điểm giao thoa giữa Frontend và Backend (đồng bộ payload phương thức thanh toán và cấu hình reverse proxy `/api` trên môi trường Production).
- **Production Deployment:** Triển khai thành công hệ thống Docker Compose (`web`, `api`, `postgres`) lên AWS EC2 với tên miền HTTPS ổn định.

## 2. What Could Be Improved (Điểm cần cải thiện)
- **Build-Time Environment Variables:** Next.js nhúng biến `NEXT_PUBLIC_API_URL` tại thời điểm build (`docker compose build`), khiến việc thiếu biến này trong file `.env` trên server làm frontend gọi nhầm `localhost:3005`.
- **API Contract Validation:** Cần thống nhất chặt chẽ hơn các giá trị enum trong DTO giữa Frontend và Backend (như trường `method` của API `/payments`) trước khi merge để tránh lỗi HTTP `400` khi tích hợp.
- **Server Resource Management:** Ổ đĩa EC2 dung lượng nhỏ (~6.7GB) dễ bị đầy (`ENOSPC`) khi rebuild Docker image nhiều lần mà chưa dọn dẹp build cache.

## 3. Action Items (Hành động khắc phục cho các giai đoạn sau)
- [x] Lưu cố định `NEXT_PUBLIC_API_URL=/api` vào tệp `.env` trên máy chủ EC2 để mọi lần deploy sau tự động nhận đúng cấu hình.
- [x] Hoàn tất kiểm thử End-to-End trên môi trường Production và lưu trữ video nghiệm thu.
- [ ] Thiết lập script tự động dọn dẹp Docker image/builder cache (`docker builder prune`) trước mỗi lần CI/CD deploy để tối ưu dung lượng ổ đĩa.