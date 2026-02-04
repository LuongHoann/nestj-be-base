# Tài liệu Module Exchange Webmail (Cập nhật: Refresh Token Flow)

Tài liệu này cung cấp cái nhìn tổng quan về luồng hoạt động (Flow) và hướng dẫn sử dụng API (Implementation) của module Exchange Webmail, phục vụ cho Frontend Developers và Testers.

---

## 1. Luồng hoạt động (Flow Doc)

Hệ thống hoạt động theo mô hình **Stateless Session** kết hợp cơ chế **Split-Token Refresh**, tương tự như module Auth chính của hệ thống.

### A. Luồng Đăng nhập (Login Flow)

**Thông tin gửi đi (Request):**

- **Endpoint**: `POST /webmail/auth/login`
- **Địa điểm gửi**: **Body (JSON)**
- **Nội dung**:
  ```json
  {
    "email": "user@domain.com",
    "password": "your_password"
  }
  ```

**Thông tin nhận về (Response):**

- **Tại Body (JSON)**: Trả về bộ đôi token mới nhất.
  ```json
  {
    "success": true,
    "accessToken": "ULID_SESSION_TOKEN",
    "refreshToken": "TOKEN_ID.TOKEN_SECRET"
  }
  ```
- **Tại Cookie (Browser Store)**: Tự động lưu vào Cookie có tên `exchange_session`. Cookie này chứa giá trị của `accessToken`.

---

### B. Luồng Làm mới Token (Refresh Flow)

**Thông tin gửi đi (Request):**

- **Endpoint**: `POST /webmail/auth/refresh`
- **Địa điểm gửi**: **Body (JSON)**
- **Nội dung**:
  ```json
  {
    "refreshToken": "TOKEN_ID.TOKEN_SECRET"
  }
  ```

**Thông tin nhận về (Response):**

- **Tại Body (JSON)**: Trả về bộ đôi token MỚI (Token cũ sẽ bị hủy ngay lập tức).
  ```json
  {
    "accessToken": "NEW_ULID_SESSION_TOKEN",
    "refreshToken": "NEW_TOKEN_ID.TOKEN_SECRET"
  }
  ```
- **Tại Cookie (Browser Store)**: Cập nhật lại giá trị mới của `accessToken` vào Cookie `exchange_session`.

---

### C. Cách sử dụng Token cho các API khác (Folders, Mail List, Send...)

Hệ thống hỗ trợ 2 cách để xác thực các yêu cầu tiếp theo:

1. **Cookie (Tự động)**: Browser sẽ tự gửi kèm Cookie `exchange_session`.
2. **Access Token**: Nếu không dùng Browser, các công cụ khác có thể gửi `accessToken` trong Header hoặc tùy biến theo Guard. (Hiện tại Guard ưu tiên nhận từ Cookie).

---

### D. Luồng Đăng xuất (Logout Flow)

**Thông tin gửi đi (Request):**

- **Endpoint**: `POST /webmail/auth/logout`
- **Địa điểm gửi**: **Body (JSON)**
- **Nội dung (Khuyên dùng)**:
  ```json
  {
    "refreshToken": "TOKEN_ID.TOKEN_SECRET"
  }
  ```
  **Kết quả**:
- Cookie `exchange_session` bị xóa ở browser.
- Access Token và Refresh Token tương ứng bị xóa khỏi Redis.

---

## 2. Hướng dẫn sử dụng API (Implements Doc)

**Base URL**: `/webmail`

### A. Xác thực (Authentication)

#### 1. Đăng nhập

- **Endpoint**: `POST /auth/login`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "accessToken": "...",
    "refreshToken": "..."
  }
  ```
- **Lưu ý**: Server cũng tự động set cookie `exchange_session` chứa `accessToken`.

#### 2. Làm mới Token

- **Endpoint**: `POST /auth/refresh`
- **Body**:
  ```json
  {
    "refreshToken": "token_id.token_secret"
  }
  ```
- **Response**: Trả về bộ token mới.

#### 3. Đăng xuất

- **Endpoint**: `POST /auth/logout`
- **Body** (Khuyên dùng):
  ```json
  {
    "refreshToken": "..."
  }
  ```
- **Mô tả**: Xóa session (Access Token) và thu hồi Refresh Token trong Redis.

---

### B. Quản lý Mail (Mail Management)

#### 1. Lấy danh sách thư mục (Folders)

- **Endpoint**: `GET /folders`
- **Response**:
  ```json
  [
    { "id": "INBOX", "name": "Hộp thư đến" },
    ...
  ]
  ```

#### 2. Lấy danh sách email

- **Endpoint**: `GET /mail`
- **Query Params**: `folder`, `page`, `pageSize`.
- **Lưu ý về ID**: ID trả về là chuỗi Base64 (ví dụ: `SU5CT1g6MTIzNDU=`). Dùng ID này cho các API chi tiết.

#### 3. Xem chi tiết email

- **Endpoint**: `GET /mail/:id`
- **Tác động**: Đánh dấu thư là **Đã đọc** trên server.

#### 4. Gửi email

- **Endpoint**: `POST /mail/send`
- **Body**: `to`, `cc`, `subject`, `htmlBody`.

---

## 3. Lưu ý cho Testers & Frontend

1. **Token Rotation**: Refresh Token chỉ sử dụng được **MỘT LẦN**. Ngay khi gọi `/refresh`, token cũ sẽ bị hủy.
2. **TTL**: Access Token hết hạn sau 1 giờ. Refresh Token hết hạn sau 7 ngày.
3. **Security**: Thông tin đăng nhập Exchange được mã hóa cực kỳ an toàn trong Redis, không bao giờ lưu dưới dạng plaintext.
