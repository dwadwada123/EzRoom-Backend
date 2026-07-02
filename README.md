# EzRoom Backend API

Đây là phần backend cho ứng dụng quản lý phòng trọ EzRoom, được viết bằng Node.js, sử dụng framework Express.js và cơ sở dữ liệu MongoDB.

Backend này cung cấp API lấy dữ liệu địa giới hành chính 34 tỉnh thành của Việt Nam theo mô hình hành chính 2 cấp mới (Tỉnh/Thành phố và Phường/Xã).

## Công nghệ sử dụng

- Node.js (v26.x hoặc mới hơn)
- Express.js (Framework web)
- MongoDB Native Driver (Kết nối cơ sở dữ liệu)
- Jest & Supertest (Kiểm thử tự động)

## Yêu cầu hệ thống

- Máy tính đã cài đặt Node.js và npm.
- Cơ sở dữ liệu MongoDB đang chạy tại localhost:27017.
- Database tên là `vietnam_provinces` có collection `provinces` chứa dữ liệu địa giới hành chính.

## Hướng dẫn thiết lập Cơ sở dữ liệu (MongoDB)

Dự án này đã đính kèm sẵn dữ liệu địa giới hành chính của 34 tỉnh thành Việt Nam trong thư mục `data/` của mã nguồn:
- `data/administrative_units.json` (Danh sách các đơn vị hành chính)
- `data/administrative_regions.json` (Danh sách các vùng địa lý)
- `data/provinces.json` (Danh sách 34 tỉnh thành và các xã/phường đi kèm)

Để nạp dữ liệu này vào MongoDB chạy local của bạn, hãy làm theo các bước hướng dẫn chi tiết sau:

### 1. Chuẩn bị công cụ nạp dữ liệu (mongoimport)
Công cụ `mongoimport` là một phần của bộ **MongoDB Database Tools**. 
- Nếu bạn chạy lệnh `mongoimport --version` trong Terminal hoặc Command Prompt báo lỗi "command not found" (lệnh không được nhận diện), bạn cần tải bộ công cụ này từ trang chủ của MongoDB: [https://www.mongodb.com/try/download/database-tools](https://www.mongodb.com/try/download/database-tools).
- Sau khi tải và giải nén, hãy thêm đường dẫn thư mục `bin` chứa file `mongoimport` vào biến môi trường PATH của hệ điều hành, hoặc copy file `mongoimport.exe` (trên Windows) vào thư mục gốc của dự án này để chạy trực tiếp.

### 2. Thực hiện nạp dữ liệu
Hãy mở Terminal hoặc Command Prompt tại thư mục gốc của dự án này và chạy tuần tự 3 lệnh sau:

```bash
mongoimport --db vietnam_provinces --collection administrative_units --file data/administrative_units.json --jsonArray --drop
mongoimport --db vietnam_provinces --collection provinces --file data/provinces.json --jsonArray --drop
mongoimport --db vietnam_provinces --collection administrative_regions --file data/administrative_regions.json --jsonArray --drop
```

*Giải thích ý nghĩa các tham số:*
- `--db`: Tên cơ sở dữ liệu cần import dữ liệu (`vietnam_provinces`).
- `--collection`: Tên bảng (collection) cần tạo và nạp dữ liệu.
- `--file`: Đường dẫn tương đối tới file JSON dữ liệu nguồn.
- `--jsonArray`: Khai báo cấu trúc của file nguồn là một mảng JSON (bao quanh bởi dấu ngoặc vuông `[]`).
- `--drop`: Xóa dữ liệu cũ nếu collection đã tồn tại trước khi ghi đè dữ liệu mới. Lựa chọn này giúp dữ liệu của bạn không bao giờ bị trùng lặp khi chạy lệnh nhiều lần.

*Lưu ý cho MongoDB có bảo mật:*
Nếu MongoDB của bạn yêu cầu tài khoản và mật khẩu để kết nối, hãy bổ sung các tham số xác thực vào câu lệnh:
```bash
mongoimport --host localhost --port 27017 -u <tên_đăng_nhập> -p <mật_khẩu> --authenticationDatabase admin --db vietnam_provinces --collection provinces --file data/provinces.json --jsonArray --drop
```

### 3. Xác minh dữ liệu đã nạp thành công
Bạn có thể kiểm tra xem dữ liệu đã được nạp chính xác chưa bằng một trong các cách sau:
- Sử dụng phần mềm đồ họa **MongoDB Compass**: Kết nối tới `mongodb://localhost:27017`, bạn sẽ thấy database `vietnam_provinces` xuất hiện với đầy đủ 3 collection và số lượng bản ghi tương ứng.
- Hoặc sử dụng Terminal thông qua **mongosh**:
  ```bash
  mongosh
  use vietnam_provinces
  db.provinces.countDocuments()
  ```
  Kết quả trả về phải là số `34`.

---

## Hướng dẫn cài đặt và chạy local (Backend Server)

Sau khi cơ sở dữ liệu đã sẵn sàng, hãy thực hiện cài đặt và chạy ứng dụng API:

1. Cài đặt các thư viện Node.js phụ thuộc:
   ```bash
   npm install
   ```

2. Khởi chạy server phát triển (Development Server):
   ```bash
   npm start
   ```
   Server sẽ lắng nghe trên cổng 3000 tại tất cả các card mạng (`0.0.0.0`), cho phép kết nối từ cả máy ảo lẫn thiết bị thật trong mạng nội bộ. Mặc định chạy tại: `http://localhost:3000`.

3. Chạy kiểm thử tự động để đảm bảo kết nối hoạt động bình thường:
   ```bash
   npm test
   ```

---

## Danh sách API Endpoints

### 1. Kiểm tra trạng thái hệ thống
- Path: `GET /health`
- HTTP Method: GET
- Kiểu trả về: JSON
- Response Mẫu:
  ```json
  {
    "status": "ok"
  }
  ```

### 2. Lấy danh sách Tỉnh/Thành phố và Phường/Xã
- Path: `GET /api/provinces`
- HTTP Method: GET
- Kiểu trả về: JSON Array
- Mô tả: API truy vấn cơ sở dữ liệu MongoDB, tự động chuyển đổi cấu trúc các trường từ dạng PascalCase sang dạng camelCase chuẩn REST API, lồng ghép phường/xã trực tiếp bên trong tỉnh/thành tương ứng và trả về kết quả.
- Response Mẫu:
  ```json
  [
    {
      "code": "01",
      "name": "Hà Nội",
      "fullName": "Thành phố Hà Nội",
      "codeName": "ha_noi",
      "type": "province",
      "administrativeUnitId": 1,
      "wards": [
        {
          "code": "00004",
          "name": "Ba Đình",
          "fullName": "Phường Ba Đình",
          "codeName": "ba_dinh",
          "type": "ward",
          "administrativeUnitId": 3
        }
      ]
    }
  ]
  ```

---

## Hướng dẫn kết nối từ Android Studio

Khi thực hiện kiểm thử trên thiết bị Android, hãy cấu hình Base URL của Retrofit tùy thuộc vào thiết bị test:

1. Chạy trên máy ảo Android (Emulator):
   - URL: `http://10.0.2.2:3000/`

2. Chạy trên thiết bị thật (Physical Device):
   - Máy tính và điện thoại phải kết nối chung một mạng Wi-Fi.
   - Tìm IP nội bộ của máy tính (Ví dụ: 192.168.2.12).
   - URL: `http://<IP-máy-tính>:3000/`
