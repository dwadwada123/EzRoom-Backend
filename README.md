# EzRoom Backend API

Day la phan backend cho ung dung quan ly phong tro EzRoom, duoc viet bang Node.js, su dung framework Express.js va co so du lieu MongoDB.

Backend nay cung cap API lay du lieu dia gioi hanh chinh 34 tinh thanh cua Viet Nam theo mo hinh hanh chinh 2 cap moi (Tinh/Thanh pho va Phuong/Xa).

## Cong nghe su dung

- Node.js (v26.x hoac moi hon)
- Express.js (Framework web)
- MongoDB Native Driver (Ket noi co so du lieu)
- Jest & Supertest (Kiem thu tu dong)

## Yeu cau he thong

- May tinh da cai dat Node.js va npm.
- Co so du lieu MongoDB dang chay tai localhost:27017.
- Database ten la `vietnam_provinces` co collection `provinces` chua du lieu dia gioi hanh chinh.

## Huong dan cai dat va chay local

1. Cai dat cac thu vien phu thuoc:
   ```bash
   npm install
   ```

2. Khoi chay server development:
   ```bash
   npm start
   ```
   Mac dinh, server se chay tai dia chi: `http://localhost:3000`

3. Chay cac bai kiem thu tu dong:
   ```bash
   npm test
   ```

## Danh sach API Endpoints

### 1. Kiem tra trang thai he thong
- Path: `GET /health`
- HTTP Method: GET
- Kieu tra ve: JSON
- Response Mau:
  ```json
  {
    "status": "ok"
  }
  ```

### 2. Lay danh sach Tinh/Thanh pho va Phuong/Xa
- Path: `GET /api/provinces`
- HTTP Method: GET
- Kieu tra ve: JSON Array
- Mo ta: API tu dong ket noi MongoDB de lay danh sach 34 tinh thanh, map cac truong tu PascalCase sang camelCase de phu hop voi Android Kotlin Model, va tra ve cau truc long nhau (nested).
- Response Mau:
  ```json
  [
    {
      "code": "01",
      "name": "Ha Noi",
      "fullName": "Thanh pho Ha Noi",
      "codeName": "ha_noi",
      "type": "province",
      "administrativeUnitId": 1,
      "wards": [
        {
          "code": "00004",
          "name": "Ba Dinh",
          "fullName": "Phuong Ba Dinh",
          "codeName": "ba_dinh",
          "type": "ward",
          "administrativeUnitId": 3
        }
      ]
    }
  ]
  ```

## Huong dan ket noi tu Android Studio

Khi thuc hien kiem thu tren thiet bi Android, hay cau hinh Base URL cua Retrofit tuy thuoc vao thiet bi test:

1. Chay tren may ao Android (Emulator):
   - URL: `http://10.0.2.2:3000/`

2. Chay tren thiet bi that (Physical Device):
   - May tinh va dien thoai phai ket noi chung mot mang Wi-Fi.
   - Tim IP noi bo cua may tinh (Vi du: 192.168.2.12).
   - URL: `http://<IP-may-tinh>:3000/`

## Luu y ve Bao mat va Git
Thu muc `.agents/` (luu tru agent skills), `.superpowers/` (nhap cua AI) va `docs/` da duoc thiet lap bo qua trong `.gitignore` de khong bi tai len GitHub.
