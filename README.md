# EzRoom Backend API

Hệ thống Backend API cho nền tảng quản lý và cho thuê phòng trọ EzRoom, được xây dựng trên nền tảng Node.js, Express, TypeScript và cơ sở dữ liệu MongoDB.

## 1. Công nghệ sử dụng

- Node.js (phiên bản 18.x hoặc mới hơn)
- TypeScript & ts-node
- Express.js (RESTful API Framework)
- MongoDB & Mongoose (Cơ sở dữ liệu NoSQL và ODM)
- PayOS SDK (Cổng thanh toán trực tuyến và chi hộ Payout)
- Cloudinary SDK (Lưu trữ và tối ưu hóa hình ảnh đám mây)
- Nodemailer (Dịch vụ gửi email tự động thông qua giao thức SMTP)
- JSON Web Token (JWT) và bcryptjs (Bảo mật, mã hóa và xác thực người dùng)
- Node-cron (Dịch vụ lập lịch tác vụ nền tự động)

## 2. Yêu cầu hệ thống

- Node.js version 18.x hoặc cao hơn.
- MongoDB Server đang hoạt động tại cổng mặc định 27017 (hoặc đường dẫn kết nối MongoDB Atlas).
- MongoDB Database Tools (công cụ `mongoimport`) để nạp dữ liệu địa giới hành chính ban đầu.

## 3. Hướng dẫn cài đặt và khởi chạy

### Bước 1: Cài đặt dependencies
Mở terminal tại thư mục gốc của EzRoom-Backend và chạy lệnh:
```bash
npm install
```

### Bước 2: Thiết lập cơ sở dữ liệu MongoDB
Nạp dữ liệu 34 tỉnh thành và các phường/xã trực thuộc vào MongoDB từ thư mục `data/`:
```bash
mongoimport --db ezroom --collection administrative_units --file data/administrative_units.json --jsonArray --drop
mongoimport --db ezroom --collection provinces --file data/provinces.json --jsonArray --drop
mongoimport --db ezroom --collection administrative_regions --file data/administrative_regions.json --jsonArray --drop
```

### Bước 3: Cấu hình biến môi trường
Sao chép file `.env.example` thành file `.env`:
```bash
cp .env.example .env
```
Cập nhật các khóa cấu hình bên trong file `.env` theo hướng dẫn chi tiết tại Mục 4 bên dưới để kết nối các dịch vụ của riêng bạn.

### Bước 4: Khởi chạy Server

- Chế độ phát triển (Development với hot-reload):
  ```bash
  npm run dev
  ```

- Biên dịch sang JavaScript (Build production):
  ```bash
  npm run build
  ```

- Khởi chạy bản build production:
  ```bash
  npm start
  ```

Mặc định server sẽ lắng nghe tại cổng 3000: `http://localhost:3000`.

## 4. Hướng dẫn cấu hình các dịch vụ bên thứ ba (Third-party Services)

Để kiểm thử đầy đủ các tính năng của hệ thống với tài khoản riêng của bạn, vui lòng thay thế các thông số trong file `.env` như sau:

### A. Cấu hình PayOS (Thu tiền cọc và thanh toán hóa đơn)
1. Đăng ký tài khoản tại https://payos.vn.
2. Tạo kênh thanh toán và lấy các thông số API:
   - `PAYOS_CLIENT_ID`: Mã Client ID do PayOS cấp.
   - `PAYOS_API_KEY`: Khóa API Key.
   - `PAYOS_CHECKSUM_KEY`: Khóa mã hóa Checksum Key.
3. Lưu ý về IP Webhook: Khi PayOS gửi thông báo thanh toán (Webhook), hãy đảm bảo địa chỉ IP công cộng của server backend đã được đăng ký trong danh sách IP cho phép trên cổng quản trị PayOS.

### B. Cấu hình PayOS Payout (Giải ngân tiền cọc tự động cho chủ trọ)
1. Kích hoạt tính năng Tài khoản chi (Payout) trên cổng quản trị PayOS.
2. Lấy bộ khóa dành riêng cho Payout:
   - `PAYOS_PAYOUT_CLIENT_ID`: Client ID của tài khoản chi.
   - `PAYOS_PAYOUT_API_KEY`: API Key của tài khoản chi.
   - `PAYOS_PAYOUT_CHECKSUM_KEY`: Checksum Key của tài khoản chi.

### C. Cấu hình Cloudinary (Lưu trữ ảnh phòng, CCCD, ảnh đại diện)
1. Đăng ký tài khoản Cloudinary tại https://cloudinary.com.
2. Truy cập Dashboard để lấy thông tin xác thực API:
   - `CLOUDINARY_CLOUD_NAME`: Tên Cloud Name của bạn.
   - `CLOUDINARY_API_KEY`: Khóa API Key.
   - `CLOUDINARY_API_SECRET`: Khóa bí mật API Secret.

### D. Cấu hình SMTP Gmail (Gửi email mã xác nhận OTP và thông báo)
1. Đăng nhập tài khoản Google của bạn, bật tính năng Xác minh 2 bước (2-Step Verification).
2. Truy cập mục Mật khẩu ứng dụng (App Passwords) để tạo mật khẩu riêng biệt gồm 16 ký tự.
3. Điền vào file `.env`:
   - `SMTP_HOST`: smtp.gmail.com
   - `SMTP_PORT`: 587
   - `SMTP_USER`: Địa chỉ email Gmail của bạn.
   - `SMTP_PASS`: Mật khẩu ứng dụng 16 ký tự vừa tạo.

### E. Cấu hình trang quản trị Admin
- `ADMIN_USERNAME`: Tên tài khoản đăng nhập trang quản trị.
- `ADMIN_PASSWORD_HASH`: Chuỗi mã hóa bcrypt của mật khẩu đăng nhập.

## 5. Danh sách các phân hệ API chính

- `/api/auth`: Đăng ký, đăng nhập, xác thực JWT, quên mật khẩu, đổi mật khẩu.
- `/api/users`: Thông tin cá nhân, nộp hồ sơ eKYC, lịch sử uy tín người thuê.
- `/api/properties`: Quản lý dãy trọ/tòa nhà phức hợp (Complex Property) và căn hộ độc lập.
- `/api/rooms`: Đăng tin tìm phòng, tìm kiếm và lọc nâng cao, danh sách phòng của chủ nhà.
- `/api/contracts`: Tạo hợp đồng điện tử, ký kết hai bên, quản lý tiền cọc Escrow.
- `/api/invoices`: Lập hóa đơn điện nước hàng tháng, thanh toán trực tuyến qua mã QR PayOS.
- `/api/disputes`: Giải quyết tranh chấp hợp đồng, kháng cáo khóa bài đăng, kháng cáo đánh giá.
- `/api/admin`: Thống kê bảng điều khiển, duyệt hồ sơ eKYC, kiểm duyệt tin đăng, quản lý tài khoản và dòng tiền.
- `/api/locations`: Danh sách 34 tỉnh thành và phường/xã theo mô hình địa giới hành chính mới.

## 6. Hướng dẫn kết nối từ ứng dụng di động và web admin

- Web Admin (EzRoom-Admin): Cấu hình `VITE_API_URL=http://localhost:3000` trong file `.env` của Admin.
- Android Máy ảo (Emulator): Sử dụng Base URL `http://10.0.2.2:3000/`.
- Android Thiết bị thật (Physical Device): Sử dụng địa chỉ IP mạng nội bộ của máy tính chạy server, ví dụ `http://192.168.1.15:3000/`.
