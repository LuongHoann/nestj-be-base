# Permanent Delete Mail API (Dev FE + QA Guide)

Tai lieu nhanh cho API xoa vinh vien email:
- `POST /webmail/mail/permanent-delete`

## 1. Preconditions

- Da login Exchange thanh cong.
- Co session hop le qua:
  - Cookie `exchange_session`, hoac
  - Header `Authorization: Bearer <accessToken>` (neu FE dang truyen token theo header).
- Header `Content-Type: application/json`.
- Co it nhat 1 email id de test (`id` dang base64 `folder:uid`, lay tu API list mail).

## 2. Endpoint

`POST /webmail/mail/permanent-delete`

## 3. Request Modes

Chi duoc gui dung 1 mode trong 3 mode sau.

### Mode A: Xoa 1 email cu the

```json
{
  "messageId": "SU5CT1g6MTIzNDU="
}
```

### Mode B: Xoa theo danh sach ids

```json
{
  "ids": ["SU5CT1g6MTIzNDU=", "SU5CT1g6MTIzNDY="]
}
```

Co the kem `sourceFolder` de backend validate tat ca ids thuoc cung folder:

```json
{
  "ids": ["U3BhbToxMDA=", "U3BhbToxMDE="],
  "sourceFolder": "spam"
}
```

### Mode C: Xoa toan bo email trong 1 folder

```json
{
  "all": true,
  "sourceFolder": "trash"
}
```

## 4. Success Response

```json
{
  "success": true,
  "deletedCount": 2
}
```

- `deletedCount`: so email da duoc xoa vinh vien.

## 5. Error Responses

### 400 Bad Request (payload khong hop le)

Vi du:
- Gui dong thoi `messageId` va `ids`.
- Gui `all: true` nhung thieu `sourceFolder`.
- Gui `ids` + `sourceFolder` nhung co id khong thuoc folder da khai bao.

Mau response:

```json
{
  "statusCode": 400,
  "message": "Payload khong hop le. Chon dung 1 mode: messageId, ids, hoac all + sourceFolder",
  "error": "Bad Request"
}
```

### 401 Unauthorized

- Session het han/khong hop le.
- Chua login.

## 6. Folder Mapping

- `inbox` -> `INBOX`
- `sent` -> `Sent Items`
- `starred` -> `Starred` (virtual folder)
- `drafts` -> `Drafts`
- `trash` -> `Trash`
- `spam` -> `Spam`

## 7. cURL Samples (QA)

### Xoa 1 email

```bash
curl -X POST http://localhost:3000/webmail/mail/permanent-delete \
  -H "Content-Type: application/json" \
  -H "Cookie: exchange_session=YOUR_SESSION_TOKEN" \
  -d '{
    "messageId": "SU5CT1g6MTIzNDU="
  }'
```

### Xoa nhieu email

```bash
curl -X POST http://localhost:3000/webmail/mail/permanent-delete \
  -H "Content-Type: application/json" \
  -H "Cookie: exchange_session=YOUR_SESSION_TOKEN" \
  -d '{
    "ids": ["U3BhbToxMDA=", "U3BhbToxMDE="],
    "sourceFolder": "spam"
  }'
```

### Xoa toan bo folder

```bash
curl -X POST http://localhost:3000/webmail/mail/permanent-delete \
  -H "Content-Type: application/json" \
  -H "Cookie: exchange_session=YOUR_SESSION_TOKEN" \
  -d '{
    "all": true,
    "sourceFolder": "trash"
  }'
```

## 8. FE Integration Notes

- API nay la hard-delete: email bi xoa khoi mailbox, khong move qua folder khac.
- Sau khi goi thanh cong, FE nen:
  - Reload danh sach mail folder hien tai.
  - Reload folder counts (`GET /webmail/folders/counts`).
  - Clear selected ids trong UI.
- Neu co trang chi tiet mail dang mo va mail vua xoa, dieu huong ve list page.

## 9. QA Checklist

- Xoa 1 email trong inbox -> email bien mat khoi list inbox, `deletedCount = 1`.
- Xoa nhieu email trong spam -> cac email do khong con trong spam, `deletedCount` dung so luong.
- Xoa toan bo trash -> list trash rong, `deletedCount` >= 0 dung voi so mail truoc do.
- Gui payload sai mode (vi du co ca `messageId` va `all`) -> tra `400`.
- Gui `all: true` nhung thieu `sourceFolder` -> tra `400`.
- Gui id khong thuoc `sourceFolder` khi co validate -> tra `400`.
- Dung session het han -> tra `401`.

## 10. Backend References

- Controller: `src/exchange/controllers/exchange.controller.ts`
- DTO: `src/exchange/dto/exchange.dto.ts` (`PermanentDeleteMailDto`)
- Service: `src/exchange/services/mail.service.ts` (`permanentDelete`)
- Provider: `src/exchange/services/imap-mail.provider.ts` (`permanentlyDeleteMessages`, `permanentlyDeleteAllMessages`)
