# BrewLite Assignment 2 - Bối cảnh và phạm vi

**Học phần:** Công nghệ Phần mềm  
**Dự án:** BrewLite - hệ thống đặt cà phê trực tuyến và thanh toán qua VNPay Sandbox<br>
**Công nghệ bắt buộc:** Next.js, NestJS, PostgreSQL và Docker

## 1. Bối cảnh nghiệp vụ

Hiện nay, khách hàng phải chờ tại quầy để xem thực đơn, chọn kích cỡ và topping, đặt món rồi thanh toán. Nhân viên có thể nhận thông tin đơn hàng chưa đầy đủ hoặc không thống nhất, gây khó khăn khi pha chế và cập nhật tình trạng đơn.

BrewLite cung cấp luồng đặt món trực tuyến, ghi nhận sản phẩm và tùy chọn khách đã chọn, kiểm tra đơn ở backend, thanh toán thử nghiệm qua VNPay Sandbox và cho phép khách xem kết quả cùng trạng thái đơn. Backend là nguồn dữ liệu chính thức về giá sản phẩm, tồn kho, trạng thái đơn và kết quả thanh toán.

## 2. Mục tiêu sản phẩm

- Giúp khách hàng xem thực đơn, chọn tùy chọn đồ uống và quản lý giỏ hàng trước khi đặt.
- Ghi nhận đơn hợp lệ và tính tổng tiền ở backend.
- Tích hợp duy nhất VNPay Sandbox để thực hiện thanh toán thử nghiệm và hiển thị đúng kết quả thành công hoặc thất bại; không xử lý tiền thật.
- Cho phép khách hàng xem xác nhận, lịch sử và trạng thái các đơn của chính mình.
- Xây dựng ứng dụng có cấu trúc dễ bảo trì, có thể kiểm thử, chạy ở môi trường local và triển khai để giảng viên đánh giá.

## 3. Các bên liên quan

| Bên liên quan | Nhu cầu và kỳ vọng | Giá trị nhận được từ BrewLite |
|---|---|---|
| Khách hàng | Xem sản phẩm và giá, tùy chỉnh đồ uống, đặt món, thanh toán thử nghiệm qua VNPay Sandbox và kiểm tra trạng thái đơn. | Thông tin đơn hàng và kết quả thanh toán rõ ràng; giảm thời gian chờ tại quầy. |
| Nhân viên quầy / Barista | Nhận đơn đã thanh toán với thông tin đầy đủ và cập nhật tiến độ pha chế. | Thông tin đơn thống nhất và hàng đợi công việc dễ theo dõi. Giao diện Barista là phần mở rộng của nhóm. |
| Quản lý cửa hàng | Nắm được quy trình đơn hàng và phục vụ, giảm sai sót tại quầy. | Quy trình xử lý đơn nhất quán. Dashboard quản lý đầy đủ nằm ngoài phạm vi hiện tại. |
| Giảng viên / nhóm nghiệm thu | Đối chiếu yêu cầu với tài liệu, mã nguồn, kiểm thử và phiên bản có thể chạy. | Có thể truy vết và đánh giá sản phẩm dựa trên minh chứng. |
| Nhóm phát triển | Phân chia công việc, thống nhất hợp đồng API/dữ liệu, kiểm thử thay đổi và giữ cho dự án có thể chạy. | Trách nhiệm rõ ràng và giảm xung đột khi tích hợp. |
| VNPay Sandbox | Nhận yêu cầu thanh toán thử nghiệm và gửi kết quả giao dịch về BrewLite. | Cung cấp luồng thanh toán có thể kiểm thử mà không phát sinh giao dịch tài chính thật. |

## 4. Phạm vi dự án

### 4.1. Phạm vi MVP bắt buộc

- Hiển thị thực đơn và chi tiết sản phẩm, gồm tên, giá, hình ảnh và tình trạng còn hàng khi có dữ liệu.
- Cho phép khách chọn kích cỡ và topping được hỗ trợ; thêm, cập nhật hoặc xóa món trong giỏ.
- Đăng ký và đăng nhập khách hàng; bảo vệ các thao tác liên quan đến đơn hàng bằng xác thực ở backend.
- Kiểm tra giỏ hàng và tùy chọn, kiểm tra tồn kho, tính tổng tiền ở backend và tạo đơn hợp lệ.
- Tích hợp VNPay Sandbox làm cổng thanh toán duy nhất và xử lý kết quả giao dịch thành công hoặc thất bại.
- Hiển thị xác nhận, lịch sử và trạng thái đơn cho khách hàng đã đăng nhập.
- Xử lý dữ liệu không hợp lệ, giỏ hàng rỗng, thiếu hàng, thanh toán thất bại và các lỗi dự kiến mà không báo thành công sai.
- Sử dụng Next.js cho frontend, NestJS cho backend và PostgreSQL để lưu dữ liệu lâu dài. Dùng Docker cho môi trường chạy local theo yêu cầu bài tập.

### 4.2. Phạm vi tùy chọn và mở rộng của nhóm

- Tìm sản phẩm theo tên hoặc từ khóa nếu nhóm giữ chức năng này trong backlog đã ưu tiên.
- Mã khuyến mãi và điểm tích lũy theo quyết định ưu tiên cuối cùng và tiêu chí chấp nhận tương ứng.
- Khu vực Barista để xem đơn đủ điều kiện đã thanh toán và cập nhật trạng thái pha chế. Đây là phần mở rộng của nhóm, không thay thế luồng đặt hàng bắt buộc cho khách hàng.

Các chức năng tùy chọn phải được đánh dấu riêng và không được làm chậm việc hoàn thành MVP bắt buộc.

### 4.3. Ngoài phạm vi

- Xử lý thanh toán thật, kết nối VNPay Production hoặc tích hợp thêm bất kỳ cổng thanh toán nào khác.
- Giao hàng đến địa chỉ khách hàng.
- Chức năng ERP/kế toán hoặc hệ thống quản trị cửa hàng đầy đủ.
- Vận hành nhiều chi nhánh.
- Hủy đơn đã thanh toán và hoàn tiền qua VNPay Sandbox/Production.

## 5. Giả định

- Dự án sử dụng danh mục sản phẩm mẫu hoặc dữ liệu seed; không kết nối với hệ thống bán hàng của một quán cà phê thật.
- Luồng đặt hàng ban đầu dành cho khách nhận món tại một quầy. Không bao gồm giao hàng hoặc nhiều chi nhánh.
- VNPay Sandbox là cổng thanh toán duy nhất; mọi giao dịch chỉ phục vụ kiểm thử và không chuyển tiền thật.
- Backend kiểm tra giá, tồn kho, trạng thái đơn và kết quả thanh toán; frontend không được xem là nguồn dữ liệu có thẩm quyền.
- Người dùng truy cập ứng dụng bằng trình duyệt web được hỗ trợ và có kết nối mạng.
- Nếu nhóm triển khai phần mở rộng Barista, tài khoản nhân viên và kiểm tra vai trò sẽ được cấu hình phục vụ nghiệm thu; việc này không đồng nghĩa với xây dựng hệ thống quản lý nhân sự đầy đủ.

## 6. Ràng buộc

- Ứng dụng phải sử dụng Next.js, NestJS và PostgreSQL; không thay thế các công nghệ bắt buộc này.
- Docker thuộc quy trình bài tập; môi trường local phải có hướng dẫn và có thể tái tạo.
- Repository nên theo cấu trúc `apps/web`, `apps/api` và `docs`; tài liệu và truy vết được lưu trong repository.
- Giao diện khách hàng được thiết kế ưu tiên thiết bị di động và định hướng PWA.
- Hệ thống chỉ sử dụng VNPay Sandbox và không được tuyên bố đã xử lý thanh toán thật.
- Secret phải được cung cấp qua cấu hình môi trường, không commit vào repository hoặc ghi ra log.
- Deployment diagram và hướng dẫn triển khai phải mô tả đúng nền tảng nhóm thực sự lựa chọn và sử dụng.
- Năm Task của bài tập được thực hiện tuần tự; tạo phẩm bắt buộc của Task trước phải có trong repository trước khi nghiệm thu Task sau.

## 7. Rủi ro ban đầu và hướng xử lý

| Rủi ro | Ảnh hưởng có thể xảy ra | Hướng xử lý ban đầu |
|---|---|---|
| Phần mở rộng Barista, khuyến mãi hoặc tích điểm làm phạm vi vượt quá thời gian cho phép. | Luồng đặt hàng, thanh toán, kiểm thử hoặc triển khai bắt buộc chưa hoàn thành. | Ưu tiên MVP bắt buộc; giữ phần mở rộng thành mục riêng và chỉ thực hiện khi luồng cốt lõi ổn định. |
| Frontend và backend dùng định nghĩa sản phẩm, giá hoặc trạng thái đơn khác nhau. | Sai tổng tiền, lỗi tích hợp hoặc hiển thị trạng thái đơn không chính xác. | Thống nhất trường dữ liệu và tên trạng thái trước khi tích hợp; backend tính giá chính thức; rà soát thay đổi theo yêu cầu. |
| Đặt hàng đồng thời hoặc gửi lại thanh toán tạo bản ghi trùng hay bán vượt tồn. | Dữ liệu đơn hàng, tồn kho hoặc thanh toán không nhất quán. | Dùng transaction và cơ chế idempotency theo yêu cầu; kiểm thử yêu cầu lặp và yêu cầu đồng thời. |
| Cấu hình triển khai khác môi trường local hoặc nền tảng đã chọn có giới hạn. | Build production hoặc health check có thể thất bại khi nghiệm thu. | Chọn nền tảng sớm, ghi rõ biến môi trường và thử quy trình triển khai trước khi bàn giao. |
| Yêu cầu, sơ đồ, mã nguồn và kiểm thử không được cập nhật đồng bộ. | Nhóm khó chứng minh phần triển khai đáp ứng đề bài. | Giữ mã FR/User Story ổn định; cập nhật ma trận truy vết và tài liệu cùng các thay đổi mã nguồn đã review. |

## 8. Điều kiện xác nhận phạm vi

Phạm vi được xem là sẵn sàng cho Task tiếp theo khi nhóm thống nhất MVP bắt buộc, tách riêng các phần mở rộng tùy chọn, xác nhận các giả định và ràng buộc nêu trên, đồng thời ghi nhận mọi thay đổi đã được chấp thuận trong tài liệu yêu cầu và lịch sử repository.
