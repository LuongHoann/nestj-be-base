# Exchange Webmail MVP Module

This module provides a backend-only integration with Microsoft Exchange Web Services (EWS) via `ews-javascript-api`.

## ⚠️ MVP ONLY WARNING

**This implementation is an MVP (Minimum Viable Product).**

1.  **Direct Credentials**: It uses direct Username/Password authentication against Exchange.
    - Credentials are encrypted using **AES-256-GCM**.
    - Key is derived using **Argon2** from a dedicated secret + user salt.
    - Stored temporarily in Redis with a 30-minute TTL.
    - **MUST** be replaced by OAuth / Modern Auth before production hardening.

2.  **No Attachments**: Attachments are out of scope.
3.  **Strict Folder Mapping**: Only supports `Inbox`, `SentItems`, `Drafts`, `DeletedItems` via `WellKnownFolderName`.

## Configuration

Ensure these environment variables are set:

```env
EXCHANGE_CRED_SECRET=complex_secret_string_for_argon2
EWS_URL=https://outlook.office365.com/EWS/Exchange.asmx
```

(See `.env.example` for details)

## Architecture

- `ExchangeAuthService`: Handles login, key derivation, encryption/decryption.
- `ExchangeClientFactory`: Creates request-scoped `ExchangeService` instances using cached credentials.
- `MailService`: Business logic for folders, listing, reading, sending.
- `ExchangeController`: Exposes REST endpoints (`/webmail/...`).

## Endpoints

- `POST /webmail/auth/login`: Login to Exchange context (requires App Auth).
- `POST /webmail/auth/logout`: Clear Exchange context.
- `GET /webmail/folders`: List supported folders.
- `GET /webmail/mail?folder=inbox&page=1`: List emails.
- `GET /webmail/mail/:id`: Read email body.
- `POST /webmail/mail/send`: Send email.
- `GET /webmail/mail/search?q=...`: Search inbox.
