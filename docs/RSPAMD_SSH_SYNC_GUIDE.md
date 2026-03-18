# Hướng dẫn cấu hình kết nối SSH cho Rspamd Sync

Tài liệu này hướng dẫn cách Admin cấu hình **SSH Private Key** để Node.js Backend có thể tự động đăng nhập vào máy chủ Gateway (Rspamd) `10.10.20.70` và cập nhật các file whitelist/blacklist, sau đó reload container thông qua lệnh `docker compose`.

---

## 1. Cấu hình biến môi trường trên Backend

Backend sẽ cần các biến môi trường sau trong file `.env` để kết nối SSH. Đảm bảo bạn đã thêm vào file `.env` của `nestjs-base-be`:

```env
# ==============================================================================
# RSPAMD SSH SYNC CONFIGURATION
# ==============================================================================
# Địa chỉ IP/Hostname của máy chủ chạy thư mục Rspamd
RSPAMD_SSH_HOST=10.10.20.70
# Port SSH (mặc định là 22)
RSPAMD_SSH_PORT=22
# User đăng nhập (thường là root do cần quyền sửa file và chạy docker compose)
RSPAMD_SSH_USER=root
# Đường dẫn absolute tới file Private Key (.pem, .key) hoặc id_rsa trên máy chạy Backend Nodejs.
# Lưu ý: Cần dùng Window Path (C:\\Users\\...) hoặc đường dẫn tương đối từ gốc project Backend.
RSPAMD_SSH_PRIVATE_KEY_PATH=./secrets/rspamd-ssh-key.pem

# Tuỳ chọn: Mật khẩu giải mã Private Key (Nếu có passphrase)
# RSPAMD_SSH_PASSPHRASE=

# Đường dẫn GỐC của project Mail Gateway trên máy chủ 10.10.20.70
RSPAMD_PROJECT_PATH=/root/webmail_exchange/mail-gateway
```

## 2. Thiết lập Private Key cho NodeJS

Do hệ thống sử dụng **SSH Private Key**, mã nguồn Backend cần có file key để kết nối. Bạn thực hiện các bước sau:

**Bước 2.1**: Tại máy chủ phát triển (máy đang chạy NestJS / Windows), tạo một thư mục tên `secrets` ở gốc `nestjs-base-be`:
```bash
mkdir secrets
```

**Bước 2.2**: Copy file private key (thường là `id_rsa` hoặc file `.pem` bạn dùng để login vào `10.10.20.70`) và dán vào thư mục `secrets`. Ví dụ:
```
nestjs-base-be/
 ├── secrets/
 │   └── rspamd-ssh-key.pem 
```

**Bước 2.3**: Đảm bảo file key KHÔNG được push lên git. Trong file `.gitignore` của máy Backend, bạn hãy kiểm tra xem thư mục `secrets/` đã được ignore chưa:
```gitignore
# Thêm dòng này vào .gitignore
secrets/
*.pem
*.key
```

## 3. Xác thực khóa Public tại máu chủ Rspamd (10.10.20.70)

Chỉ cần làm bước này NẾU máy chủ `10.10.20.70` chưa cấu hình sẵn private/public key hoặc key mới sinh. Đảm bảo rằng nội dung Public Key (ví dụ `id_rsa.pub` tương ứng với private key) đã được thêm vào file `~/.ssh/authorized_keys` của tài khoản `root` trên server `10.10.20.70`!

---

## 4. Cách hệ thống Reload Rspamd tự động

Sau khi API tại file Backend hoàn tất thao tác `echo` / `sed` thêm bớt email/domain vào file cấu hình trên server remote, SSH Client từ NodeJS sẽ thực thi ngay câu lệnh sau để tự động Reload `rspamd`:
```bash
docker exec -t rspamd rspamadm control reload
```
*(Ghi chú: Đã bỏ cờ `-i` để lệnh có thể chạy ngầm tốt nhất qua SSH non-interactive)*

Từ thời điểm này luật kiểm duyệt chặn (black)/gỡ (white) sẽ có hiệu lực ngay lập tức. CSDL PostgreSQL của dự án sẽ đóng vai trò Audit lưu trữ thông tin quản trị và giao diện UI Web. File Remote sẽ là Nguồn cấu hình chạy thực tế của Gateway.
