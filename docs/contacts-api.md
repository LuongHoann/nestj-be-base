# Contacts API (Webmail)

Base path: `{{API_BASE}}/webmail/contacts`

Auth:
- Cookie `exchange_session`
- Or header `Authorization: Bearer <token>`

Model:
- `ExchangeContact`
  - `id`: string (encoded, use as-is)
  - `displayName`: string
  - `email`: string
  - `givenName?`: string
  - `surname?`: string
  - `company?`: string
  - `jobTitle?`: string
  - `phone?`: string
  - `address?`: object

- `ExchangeContactAddress`
  - `street?`: string
  - `city?`: string
  - `state?`: string
  - `postalCode?`: string
  - `country?`: string
- `ExchangeSearchResult<T>`
  - `items`: T[]
  - `total`: number

Notes:
- `id` is base64 with internal prefix `CONTACTS:`. FE should not decode.
- Create returns optional fields as empty strings if not provided.
- Update behavior:
  - If `phone` is omitted: keep current value.
  - If `phone` is `""`: clear the phone.
- `email` must be unique (checked against EmailAddress1/2/3).

---

## 1) Create contact
`POST {{API_BASE}}/webmail/contacts`

Body:
```json
{
  "email": "user@example.com",
  "displayName": "User Name",
  "givenName": "User",
  "surname": "Name",
  "company": "ACME",
  "jobTitle": "Engineer",
  "phone": "0900000000",
  "address": {
    "street": "123 Nguyen Trai",
    "city": "HCM",
    "state": "Q1",
    "postalCode": "70000",
    "country": "VN"
  }
}
```

Response 200:
```json
{
  "id": "Q09OVEFDVFM6AAMk...==",
  "displayName": "User Name",
  "email": "user@example.com",
  "givenName": "User",
  "surname": "Name",
  "company": "ACME",
  "jobTitle": "Engineer",
  "phone": "0900000000",
  "address": {
    "street": "123 Nguyen Trai",
    "city": "HCM",
    "state": "Q1",
    "postalCode": "70000",
    "country": "VN"
  }
}
```

Errors:
- 400 `Email is required`
- 400 `Contact email already exists`
- 401 Unauthorized (missing/invalid session)

---

## 2) Update contact
`PUT {{API_BASE}}/webmail/contacts/:id`

Body (all optional):
```json
{
  "displayName": "New Name",
  "email": "new@example.com",
  "givenName": "New",
  "surname": "Name",
  "company": "New Co",
  "jobTitle": "Lead",
  "phone": "",
  "address": {
    "street": "",
    "city": "",
    "state": "",
    "postalCode": "",
    "country": ""
  }
}
```

Response 200:
```json
{
  "id": "Q09OVEFDVFM6AAMk...==",
  "displayName": "New Name",
  "email": "new@example.com",
  "givenName": "New",
  "surname": "Name",
  "company": "New Co",
  "jobTitle": "Lead",
  "phone": "",
  "address": {
    "street": "",
    "city": "",
    "state": "",
    "postalCode": "",
    "country": ""
  }
}
```

Errors:
- 400 `Contact email already exists`
- 401 Unauthorized (missing/invalid session)

---

## 3) Delete contact
`DELETE {{API_BASE}}/webmail/contacts/:id`

Response 200:
```json
{ "success": true }
```

Errors:
- 401 Unauthorized (missing/invalid session)

---

## 4) Get contact by email
`GET {{API_BASE}}/webmail/contacts/by-email?email=user@example.com`

Response 200:
```json
{
  "id": "Q09OVEFDVFM6AAMk...==",
  "displayName": "User Name",
  "email": "user@example.com",
  "givenName": "User",
  "surname": "Name",
  "company": "ACME",
  "jobTitle": "Engineer",
  "phone": "0900000000",
  "address": {
    "street": "123 Nguyen Trai",
    "city": "HCM",
    "state": "Q1",
    "postalCode": "70000",
    "country": "VN"
  }
}
```

If not found: `null`

Errors:
- 401 Unauthorized (missing/invalid session)

---

## 5) Get contacts count
`GET {{API_BASE}}/webmail/contacts/count`

Response 200:
```json
{ "total": 123 }
```

Errors:
- 401 Unauthorized (missing/invalid session)

---

## 6) Get contact by id
`GET {{API_BASE}}/webmail/contacts/:id`

Response 200:
```json
{
  "id": "Q09OVEFDVFM6AAMk...==",
  "displayName": "User Name",
  "email": "user@example.com",
  "givenName": "User",
  "surname": "Name",
  "company": "ACME",
  "jobTitle": "Engineer",
  "phone": "0900000000",
  "address": {
    "street": "123 Nguyen Trai",
    "city": "HCM",
    "state": "Q1",
    "postalCode": "70000",
    "country": "VN"
  }
}
```

If not found: `null`

Errors:
- 401 Unauthorized (missing/invalid session)

---

## 7) Search contacts
`GET {{API_BASE}}/webmail/contacts`

Query:
- `q` string, optional (search by display name or email)
- `page` number, optional, default `1`
- `pageSize` number, optional, default `20`

Response 200:
```json
{
  "items": [
    {
      "id": "Q09OVEFDVFM6AAMk...==",
      "displayName": "User Name",
      "email": "user@example.com",
      "givenName": "User",
      "surname": "Name",
      "company": "ACME",
      "jobTitle": "Engineer",
      "phone": "0900000000",
      "address": {
        "street": "123 Nguyen Trai",
        "city": "HCM",
        "state": "Q1",
        "postalCode": "70000",
        "country": "VN"
      }
    }
  ],
  "total": 1
}
```

If `q` is empty, returns all contacts with pagination.
