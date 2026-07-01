# Đặc tả Thiết kế API Địa giới Hành chính Việt Nam (3 Cấp)

Tài liệu này đặc tả kiến trúc và thiết kế cho API cung cấp dữ liệu địa giới hành chính Việt Nam (Tỉnh/Thành phố -> Quận/Huyện -> Phường/Xã) phục vụ cho ứng dụng EzRoom (Android & Web).

## 1. Yêu cầu & Kiến trúc hệ thống
* **Database**: MongoDB chạy tại `localhost:27017` (Database: `vietnam_provinces`, Collection: `provinces`).
* **Backend**: Node.js + Express.js, kết nối với MongoDB qua Driver chính thức (`mongodb`).
* **Android**: Sử dụng Retrofit kết nối tới backend qua URL local `http://10.0.2.2:3000/api/provinces`.
* **Mô hình bộ lọc**: Bộ lọc 3 cấp xếp chồng (Cascade Dropdown):
  1. Chọn Tỉnh/Thành phố ➡️ Kích hoạt danh sách Quận/Huyện.
  2. Chọn Quận/Huyện ➡️ Kích hoạt danh sách Phường/Xã.

Để tối ưu hiệu năng và trải nghiệm người dùng, API sẽ trả về **toàn bộ cấu trúc lồng nhau (nested)** trong một lượt gọi duy nhất. Android sẽ lưu cache danh sách này ở bộ nhớ tạm để người dùng lọc ngoại tuyến (offline) mượt mà không bị gián đoạn mạng.

---

## 2. Cấu trúc cơ sở dữ liệu & Cấu trúc API JSON

Dữ liệu được chuẩn hóa về định dạng **camelCase** (chuẩn REST API & dễ ánh xạ sang Kotlin Data Class):

### JSON Đầu ra từ `GET /api/provinces`
```json
[
  {
    "name": "Thành phố Hà Nội",
    "code": 1,
    "divisionType": "thành phố trung ương",
    "codename": "thanh_pho_ha_noi",
    "phoneCode": 24,
    "districts": [
      {
        "name": "Quận Ba Đình",
        "code": 1,
        "divisionType": "quận",
        "codename": "quan_ba_dinh",
        "provinceCode": 1,
        "wards": [
          {
            "name": "Phường Phúc Xá",
            "code": 1,
            "divisionType": "phường",
            "codename": "phuong_phuc_xa",
            "districtCode": 1
          }
        ]
      }
    ]
  }
]
```

---

## 3. Bản thiết kế cho Agent Android Studio (Kotlin Data Classes)
Cung cấp các Data Class sau để Agent bên phía Android Studio có thể cấu hình lớp mô hình dữ liệu chính xác tuyệt đối:

```kotlin
data class Province(
    val name: String,
    val code: Int,
    val divisionType: String,
    val codename: String,
    val phoneCode: Int,
    val districts: List<District>
)

data class District(
    val name: String,
    val code: Int,
    val divisionType: String,
    val codename: String,
    val provinceCode: Int,
    val wards: List<Ward>
)

data class Ward(
    val name: String,
    val code: Int,
    val divisionType: String,
    val codename: String,
    val districtCode: Int
)
```

---

## 4. Kế hoạch triển khai (Implementation Plan)
1. **Dữ liệu**: Khởi tạo và chạy script import dữ liệu chuẩn 3 cấp từ `provinces.open-api.vn` (63 tỉnh thành, đầy đủ quận/huyện, xã/phường) vào MongoDB `vietnam_provinces` (collection `provinces`).
2. **Backend**:
   * Khởi tạo dự án Express.js.
   * Tạo route `/api/provinces` truy vấn MongoDB.
   * Ánh xạ (Map) các trường dữ liệu từ cơ sở dữ liệu sang định dạng camelCase.
3. **Kiểm thử**: Đảm bảo API trả về đúng định dạng và có thể kết nối được từ máy chủ phát triển.
