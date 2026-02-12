# Batch Mail APIs (Dev + QA Guide)

Tai lieu nhanh cho 2 API moi:
- `POST /webmail/mail/mark-as-read`
- `POST /webmail/mail/move-batch`

## 1. Preconditions

- Da login Exchange, co `accessToken` hop le.
- Header:
  - `Authorization: Bearer <ACCESS_TOKEN>`
  - `Content-Type: application/json`
- Co it nhat 1 email id de test (`id` dang base64 `folder:uid`, lay tu API list mail).

## 2. API: Mark As Read

### Endpoint

`POST /webmail/mail/mark-as-read`

### Mode A: Mark theo danh sach ids

```json
{
  "ids": ["SU5CT1g6MTIzNDU=", "SU5CT1g6MTIzNDY="],
  "isRead": true
}
```

### Mode B: Mark toan bo folder

```json
{
  "all": true,
  "folder": "inbox",
  "isRead": false
}
```

### Success response

```json
{
  "success": true
}
```

### Curl test

```bash
curl -X POST http://localhost:3000/webmail/mail/mark-as-read \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["SU5CT1g6MTIzNDU="],
    "isRead": true
  }'
```

## 3. API: Move Batch

### Endpoint

`POST /webmail/mail/move-batch`

### Mode A: Move theo danh sach ids

```json
{
  "ids": ["SU5CT1g6MTIzNDU=", "SU5CT1g6MTIzNDY="],
  "targetFolder": "trash"
}
```

### Mode B: Move toan bo email trong source folder

```json
{
  "all": true,
  "sourceFolder": "spam",
  "targetFolder": "inbox"
}
```

### Success response

```json
{
  "success": true
}
```

### Curl test

```bash
curl -X POST http://localhost:3000/webmail/mail/move-batch \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["SU5CT1g6MTIzNDU="],
    "targetFolder": "trash"
  }'
```

## 4. Folder Mapping

- `inbox` -> `INBOX`
- `sent` -> `Sent Items`
- `starred` -> `Starred`
- `drafts` -> `Drafts`
- `trash` -> `Trash`
- `spam` -> `Spam`

## 5. QA Checklist

- Mark 1 email as read -> list API tra ve `isRead = true`.
- Mark 1 email as unread -> list API tra ve `isRead = false`.
- Mark all inbox as read -> random sample trong inbox deu `isRead = true`.
- Move selected emails to trash -> khong con trong source folder, co trong trash.
- Move all spam to inbox -> spam giam, inbox tang.
- Goi API voi token het han -> tra `401`.
- Goi API voi payload thieu field bat buoc -> tra `400`.

## 6. Dev Notes

- Controller:
  - `src/exchange/controllers/exchange.controller.ts`
- DTO:
  - `src/exchange/dto/exchange.dto.ts` (`MarkReadDto`, `MoveBatchDto`)
- Service:
  - `src/exchange/services/mail.service.ts`
- Provider:
  - `src/exchange/services/imap-mail.provider.ts`
