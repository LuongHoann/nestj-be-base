# Hướng Dẫn Triển Khai Module Mailbox (Backend + Frontend)

## 1. Tổng quan
Module quản lý user/mailbox cho Exchange on‑prem:
- CRUD mailbox thật thông qua script.
- Tra cứu GAL qua EWS.
- Đồng bộ DB → Exchange.
- Xóa = disable mailbox.

## 2. Cấu hình Backend

### 2.1. Biến môi trường
Thêm vào `.env` (tham khảo `.env.example`):
```
MAILBOX_SCRIPT_CREATE=<path-to-create-script>
MAILBOX_SCRIPT_UPDATE=<path-to-update-script>
MAILBOX_SCRIPT_DISABLE=<path-to-disable-script>
MAILBOX_SCRIPT_TIMEOUT_MS=60000

# Dùng cho GAL khi không bật SSO
EWS_ADMIN_EMAIL=<admin@domain.local>
EWS_ADMIN_PASSWORD=<admin_password>
```

### 2.2. Hợp đồng Script
Backend gọi script qua stdin với JSON payload:

Create:
```json
{ "action": "create", "email": "user@domain.local", "name": "User Name", "password": "Temp@123" }
```
Update:
```json
{ "action": "update", "email": "new@domain.local", "oldEmail": "old@domain.local", "name": "New Name", "isActive": true }
```
Disable:
```json
{ "action": "disable", "email": "user@domain.local" }
```

Script cần:
- đọc JSON từ stdin
- trả exit code 0 nếu thành công
- ghi lỗi vào stderr nếu thất bại

### 2.3. Kết nối Module
Module đã được mount sẵn trong `AppModule`:
- `src/mailbox/*`
- `src/app.module.ts`

### 2.4. GAL (EWS)
GAL search dùng EWS ResolveName.
Nếu `EWS_SSO_ENABLED=false`, cần `EWS_ADMIN_EMAIL` và `EWS_ADMIN_PASSWORD`.

## 3. API cho Frontend

### Auth (Cookie)
Tất cả endpoint yêu cầu cookie đăng nhập (JWT cookie do backend set).
Header:
```
Cookie: exchange_session=<token>
```

### 3.1. Danh sách mailbox
`GET /mailbox`
Query: `page`, `pageSize`, `search`

Response:
```json
{ "items": [ { "id": "...", "email": "...", "name": "..." } ], "total": 12, "page": 1, "pageSize": 20 }
```

### 3.2. Chi tiết mailbox
`GET /mailbox/:id`

### 3.3. Tạo mailbox
`POST /mailbox`
Body:
```json
{ "email": "user@domain.local", "name": "User Name", "password": "Temp@123" }
```

### 3.4. Cập nhật mailbox
`PUT /mailbox/:id`
Body:
```json
{ "name": "New Name", "email": "new@domain.local", "isActive": true }
```

### 3.5. Vô hiệu hóa mailbox
`DELETE /mailbox/:id`

### 3.6. Import CSV
`POST /mailbox/import`
Body:
```json
{ "csv": "email,name,password\nuser@domain.local,User Name,Temp@123" }
```
Response:
```json
{ "results": [ { "email": "user@domain.local", "success": true } ] }
```

### 3.7. Tra cứu GAL
`GET /mailbox/gal/search?q=<keyword>`

Response:
```json
[ { "name": "User Name", "email": "user@domain.local" } ]
```

### 3.8. Đồng bộ mailbox
`POST /mailbox/sync/:id`
Body (optional):
```json
{ "password": "Temp@123" }
```

## 4. Ghi chú cho Frontend
- Khi tạo user, UI nên yêu cầu `email`, `name`, `password`.
- Update cho phép đổi email/name.
- Delete chỉ là disable, không xóa DB record.
- CSV import: FE chỉ cần gửi string raw.

## 5. Xử lý lỗi
- `409 Conflict` nếu email đã tồn tại.
- `404 Not Found` nếu user không có.
- `400 Bad Request` nếu CSV thiếu header hoặc sync thiếu password.
- Lỗi script sẽ trả `500` với message từ stderr.

## 6. Ví dụ Script PowerShell (Pseudo)
```powershell
# Read JSON payload
$inputJson = [Console]::In.ReadToEnd()
$data = $inputJson | ConvertFrom-Json

switch ($data.action) {
  'create' { New-Mailbox -UserPrincipalName $data.email -Name $data.name -Password (ConvertTo-SecureString $data.password -AsPlainText -Force) }
  'update' { Set-Mailbox -Identity $data.oldEmail -PrimarySmtpAddress $data.email -DisplayName $data.name }
  'disable' { Disable-Mailbox -Identity $data.email -Confirm:$false }
}
```

## 7. Checklist triển khai
- [ ] Cấu hình env script path
- [ ] Cấu hình EWS admin nếu cần
- [ ] Kiểm tra script chạy thủ công OK
- [ ] Test API create/update/delete
- [ ] Test GAL search

## Script cấu hình mẫu
Các script PowerShell mẫu đã được đặt trong `scripts/mailbox/`:
- `create-mailbox.ps1`
- `update-mailbox.ps1`
- `disable-mailbox.ps1`

Trong `.env` dùng các path mặc định:
```
MAILBOX_SCRIPT_CREATE=./scripts/mailbox/create-mailbox.ps1
MAILBOX_SCRIPT_UPDATE=./scripts/mailbox/update-mailbox.ps1
MAILBOX_SCRIPT_DISABLE=./scripts/mailbox/disable-mailbox.ps1
```

Lưu ý:
- Các script này yêu cầu chạy trong môi trường có Exchange Management Shell.
- Nếu chạy trên server khác, cần mở remote session hoặc cài tool phù hợp.
