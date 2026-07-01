# Đặc tả Thiết kế API Địa giới Hành chính Việt Nam (Mô hình 2 Cấp Mới)

Tài liệu này đặc tả kiến trúc và thiết kế cho API cung cấp dữ liệu địa giới hành chính Việt Nam theo mô hình hành chính mới từ tháng 07/2025 (loại bỏ cấp Quận/Huyện trung gian, giảm xuống còn 34 Tỉnh/Thành phố trực thuộc trung ương và trực tiếp quản lý cấp Phường/Xã).

## 1. Yêu cầu & Kiến trúc hệ thống
* **Database**: MongoDB chạy tại `localhost:27017` (Database: `vietnam_provinces`, Collection: `provinces`). Sử dụng dữ liệu hiện có (gồm 34 tỉnh thành và các xã/phường thuộc quản lý).
* **Backend**: Node.js + Express.js, kết nối với MongoDB qua Driver chính thức (`mongodb`).
* **Android**: Sử dụng Retrofit kết nối tới backend qua URL local `http://10.0.2.2:3000/api/provinces`.
* **Mô hình bộ lọc trên Android**: Bộ lọc 2 cấp (Cascade Dropdown):
  1. Chọn Tỉnh/Thành phố (trong số 34 tỉnh thành mới).
  2. Chọn Phường/Xã (được truy xuất trực tiếp từ danh sách `wards` của Tỉnh/Thành phố đã chọn).
  
Cách thiết kế này phản ánh đúng thực tế hành chính Việt Nam hiện tại (năm 2026) và giải quyết triệt để vấn đề thiếu khóa liên kết giữa các cấp địa lý trong database cũ.

---

## 2. Cấu trúc cơ sở dữ liệu & Cấu trúc API JSON

Dữ liệu từ MongoDB (PascalCase) sẽ được API ánh xạ và trả về dưới dạng **camelCase** chuẩn REST:

### JSON Đầu ra từ `GET /api/provinces`
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
      },
      {
        "code": "00008",
        "name": "Ngọc Hà",
        "fullName": "Phường Ngọc Hà",
        "codeName": "ngoc_ha",
        "type": "ward",
        "administrativeUnitId": 3
      }
    ]
  }
]
```

---

## 3. Bản thiết kế cho Agent Android Studio (Kotlin Data Classes)
Cung cấp các lớp dữ liệu Kotlin để Agent phía Android đồng bộ hóa cấu trúc dữ liệu:

```kotlin
data class Province(
    val code: String,
    val name: String,
    val fullName: String,
    val codeName: String,
    val type: String,
    val administrativeUnitId: Int,
    val wards: List<Ward>
)

data class Ward(
    val code: String,
    val name: String,
    val fullName: String,
    val codeName: String,
    val type: String,
    val administrativeUnitId: Int
)
```

---

## 4. Kế hoạch triển khai (Implementation Plan)
1. **Dữ liệu**: Giữ nguyên dữ liệu hiện tại trong MongoDB. Không thực hiện việc import dữ liệu 63 tỉnh thành cũ.
2. **Backend**:
   * Khởi tạo dự án Express.js trong workspace.
   * Cấu hình kết nối tới database `vietnam_provinces`.
   * Xây dựng route `/api/provinces` thực hiện ánh xạ các trường từ MongoDB PascalCase sang camelCase.
3. **Kiểm thử & Bàn giao**: Chạy thử nghiệm local và cung cấp URL `http://10.0.2.2:3000/api/provinces` cùng với JSON mẫu để chuyển cho Agent phía Android Studio.

