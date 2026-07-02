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

## Hướng dẫn cài đặt và chạy local

1. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```

2. Khởi chạy server development:
   ```bash
   npm start
   ```
   Mặc định, server sẽ chạy tại địa chỉ: `http://localhost:3000`

3. Chạy các bài kiểm thử tự động:
   ```bash
   npm test
   ```

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
- Mô tả: API tự động kết nối MongoDB để lấy danh sách 34 tỉnh thành, map các trường từ PascalCase sang camelCase để phù hợp với Android Kotlin Model, và trả về cấu trúc lồng nhau (nested).
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

## Hướng dẫn kết nối từ Android Studio

Khi thực hiện kiểm thử trên thiết bị Android, hãy cấu hình Base URL của Retrofit tùy thuộc vào thiết bị test:

1. Chạy trên máy ảo Android (Emulator):
   - URL: `http://10.0.2.2:3000/`

2. Chạy trên thiết bị thật (Physical Device):
   - Máy tính và điện thoại phải kết nối chung một mạng Wi-Fi.
   - Tìm IP nội bộ của máy tính (Ví dụ: 192.168.2.12).
   - URL: `http://<IP-máy-tính>:3000/`

## Hướng dẫn thiết lập Cơ sở dữ liệu (MongoDB)

Dự án này đã đính kèm sẵn dữ liệu mẫu dạng JSON của 34 tỉnh thành Việt Nam trong thư mục `data/`. Để import dữ liệu này vào MongoDB chạy local của bạn, hãy làm theo các bước sau:

1. Đảm bảo dịch vụ MongoDB đã được khởi chạy trên máy của bạn (mặc định tại cổng 27017).

2. Mở Terminal hoặc Command Prompt tại thư mục gốc của dự án này và chạy các lệnh `mongoimport` sau:

   ```bash
   mongoimport --db vietnam_provinces --collection administrative_units --file data/administrative_units.json --jsonArray --drop
   mongoimport --db vietnam_provinces --collection provinces --file data/provinces.json --jsonArray --drop
   mongoimport --db vietnam_provinces --collection administrative_regions --file data/administrative_regions.json --jsonArray --drop
   ```

   *Giải thích các tham số:*
   - `--db`: Tên database cần tạo/sử dụng (`vietnam_provinces`).
   - `--collection`: Tên collection cần import dữ liệu.
   - `--file`: Đường dẫn tới file JSON dữ liệu nguồn.
   - `--jsonArray`: Chỉ định định dạng file nguồn là một mảng JSON.
   - `--drop`: Xóa dữ liệu cũ của collection đó trước khi ghi đè dữ liệu mới để tránh bị trùng lặp.

