# Move Mail API Documentation

## Endpoint

```
POST /webmail/mail/move
```

## Description

Di chuyển email từ folder này sang folder khác sử dụng IMAP MOVE command native.

## Authentication

Yêu cầu `ExchangeAuthGuard` - cần có session token hợp lệ trong cookie hoặc Authorization header.

## Request Body

```typescript
{
  "messageId": string,    // ID của email cần di chuyển (base64 encoded: folder:uid)
  "targetFolder": string  // Folder đích (có thể dùng tên ngắn hoặc tên đầy đủ)
}
```

### Supported Target Folders

Bạn có thể sử dụng tên ngắn (sẽ được map tự động):

- `inbox` → `INBOX`
- `sent` → `Sent Items`
- `starred` → `Starred`
- `drafts` → `Drafts`
- `trash` → `Trash`
- `spam` → `Spam`

Hoặc sử dụng tên folder đầy đủ trực tiếp (ví dụ: `Sent Items`, `Drafts`, etc.)

## Example Requests

### 1. Di chuyển email từ Inbox sang Trash

```bash
curl -X POST http://localhost:3000/webmail/mail/move \
  -H "Content-Type: application/json" \
  -H "Cookie: exchange_session=YOUR_SESSION_TOKEN" \
  -d '{
    "messageId": "SU5CT1g6MTIzNDU=",
    "targetFolder": "trash"
  }'
```

### 2. Di chuyển email từ Inbox sang Drafts

```bash
curl -X POST http://localhost:3000/webmail/mail/move \
  -H "Content-Type: application/json" \
  -H "Cookie: exchange_session=YOUR_SESSION_TOKEN" \
  -d '{
    "messageId": "SU5CT1g6MTIzNDU=",
    "targetFolder": "drafts"
  }'
```

### 3. Di chuyển email sang folder với tên đầy đủ

```bash
curl -X POST http://localhost:3000/webmail/mail/move \
  -H "Content-Type: application/json" \
  -H "Cookie: exchange_session=YOUR_SESSION_TOKEN" \
  -d '{
    "messageId": "SU5CT1g6MTIzNDU=",
    "targetFolder": "Sent Items"
  }'
```

## Response

### Success Response

```json
{
  "success": true
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Error message here",
  "error": "Bad Request"
}
```

## Implementation Details

### Backend Flow

1. **Controller** (`exchange.controller.ts`):
   - Nhận request với `MoveMailDto`
   - Validate dữ liệu đầu vào
   - Gọi `mailService.moveMessage()`

2. **Service** (`mail.service.ts`):
   - Map folder type sang folder ID thực tế
   - Gọi provider với connection management (`withProvider`)

3. **Provider** (`imap-mail.provider.ts`):
   - Decode messageId để lấy source folder và UID
   - Sử dụng `client.messageMove()` với native IMAP MOVE command
   - Lock source folder trong quá trình di chuyển
   - Log kết quả

### Technical Notes

- Sử dụng **native IMAP MOVE command** (RFC 6851) - hiệu quả hơn COPY + DELETE
- Tự động lock mailbox trong quá trình di chuyển để tránh race conditions
- Message ID được encode dưới dạng base64: `folder:uid`
- Hỗ trợ đầy đủ error handling và logging

## Validation Rules

- `messageId`: Bắt buộc, phải là string không rỗng
- `targetFolder`: Bắt buộc, phải là string không rỗng

## Error Cases

- Message không tồn tại
- Folder đích không tồn tại
- Không có quyền truy cập folder
- Session hết hạn hoặc không hợp lệ
- IMAP connection error
