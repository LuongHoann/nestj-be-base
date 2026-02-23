# Project Implemented Features

Cap nhat den: 2026-02-12

Tai lieu nay tong hop cac chuc nang da duoc trien khai trong du an `nestjs-base-be`.

## 1. Nen tang he thong

- Framework backend: NestJS.
- ORM: MikroORM voi PostgreSQL.
- Cache: Dragonfly/Redis (qua `DragonflyService`).
- Global request context interceptor da duoc ap dung.
- Global audit interceptor da duoc ap dung cho CUD requests.

## 2. Module Auth (`/auth`)

Chuc nang hien co:
- `GET /auth/me`
- Xac thuc bang JWT (`JwtAuthGuard`).
- Tra thong tin user hien tai tu database.

Ghi chu:
- Cac endpoint login/refresh/logout khong nam o module `auth`, ma nam trong module `exchange` voi prefix `/webmail/auth`.

## 3. Module Exchange Webmail (`/webmail`)

### 3.1 Exchange Authentication

- `POST /webmail/auth/login`
  - Dang nhap Exchange (email/password).
  - Tao `accessToken` + `refreshToken`.
  - Set cookie `exchange_session`.
  - Tu dong khoi tao mailbox folders neu chua co.
- `POST /webmail/auth/refresh`
  - Rotate refresh token.
  - Cap lai access token va cookie session.
- `POST /webmail/auth/logout`
  - Xoa session token va revoke refresh token.

### 3.2 Mailbox APIs

- `GET /webmail/folders`
  - Lay danh sach folder tieu chuan.
- `GET /webmail/folders/counts`
  - Lay tong so mail va so unread theo folder.
  - Co cache theo user/folder.
- `GET /webmail/mail?folder=&page=&pageSize=`
  - Lay danh sach mail co phan trang.
- `GET /webmail/mail/search?q=&page=`
  - Tim kiem mail.
- `GET /webmail/mail/:id`
  - Lay chi tiet 1 mail.

### 3.3 Mail Actions

- `POST /webmail/mail/send`
  - Gui email (to/cc/bcc/replyTo/attachments).
  - Append vao Sent Items.
- `POST /webmail/mail/move`
  - Move 1 email sang folder khac.
- `POST /webmail/mail/mark-as-read`
  - Danh dau read/unread theo ids hoac all trong folder.
- `POST /webmail/mail/move-batch`
  - Move hang loat theo ids hoac all trong source folder.
- `POST /webmail/mail/permanent-delete`
  - Xoa vinh vien theo 3 mode:
    - 1 message (`messageId`)
    - danh sach ids (`ids[]`)
    - toan bo mail trong folder (`all + sourceFolder`)

### 3.4 Bao mat va ky thuat trong Exchange

- Session credentials duoc ma hoa trong cache.
- Refresh token duoc hash va rotate.
- Folder alias mapping (`inbox/sent/drafts/spam/trash/starred`) da ho tro.
- Starred duoc xu ly theo flagged mails.
- Co interceptor chuan hoa loi Exchange API.

## 4. Module Files (`/files`, `/assets`)

### 4.1 Upload va quan ly file

- `POST /files/upload`
  - Upload file vao temp storage.
  - Validate mime type va max file size.
- `GET /files/temp/:id/preview`
  - Preview file temp (stream).
- `POST /files/commit`
  - Commit file tu temp sang permanent storage.
  - Cap nhat metadata (extraMetadata, originalName).
- `GET /files/:id`
  - Lay metadata file.
- `GET /assets/:id`
  - Stream file permanent (inline/download).

### 4.2 Storage

- Local storage adapter da trien khai:
  - Save temp
  - Move to permanent
  - Stream file
  - Delete file
  - Check exists
  - Get size

### 4.3 Scheduler

- Job cleanup temp files da trien khai.
- Chu ky: 5 ngay/lan (UTC midnight theo cron cau hinh hien tai).
- Xoa temp files cu hon 5 ngay va don record database.

## 5. Module Audit

- Audit log interceptor global cho cac request POST/PATCH/PUT/DELETE.
- Dev logs + user audit logs da phan tach.
- Mask sensitive fields trong logs (`password`, `token`, `refreshToken`, ...).
- Luu audit trail vao bang `audit_log`.
- Audit service ho tro truy van logs theo user, action, collection, time range.

## 6. Module Meta

- Da co `EntityRegistryService` va `MetadataReaderService` de ho tro metadata/entity registry cho he thong.

## 7. Database Entities da dung

- `User`
- `File`
- `AuditLog`

## 8. Tai lieu API da co trong repo

- `docs/EXCHANGE_API_DOCUMENTATION.md`
- `docs/BATCH_MAIL_APIS.md`
- `docs/PERMANENT_DELETE_MAIL_API.md`
