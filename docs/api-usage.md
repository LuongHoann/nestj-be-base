# API Usage Guide

## Overview

The system automatically exposes REST APIs for all registered entities via the `/items/:collection` endpoint pattern.

## Collection Mapping

The `:collection` parameter maps to the **table name** of your entity:

- `User` entity with `@Entity()` → `/items/user`
- `Post` entity → `/items/post`
- `Comment` entity → `/items/comment`

**Note:** Use the singular, lowercase table name, not the class name.

## Basic Operations

### List Items

```http
GET /items/post
```

### Get Single Item

```http
GET /items/post/123
```

### Create Item

```http
POST /items/post
Content-Type: application/json

{
  "title": "Hello World",
  "content": "...",
  "status": "draft"
}
```

### Update Item

```http
PATCH /items/post/123
Content-Type: application/json

{
  "status": "published"
}
```

### Delete Item

```http
DELETE /items/post/123
```

## Query Parameters

### Filtering

Use `filter` parameter with JSON object:

**Simple equality:**

```http
GET /items/post?filter={"status":"published"}
```

**Operators:**

```http
GET /items/post?filter={"views":{"_gte":100}}
```

Supported operators:

- `_eq`, `_neq` - equals, not equals
- `_gt`, `_gte`, `_lt`, `_lte` - comparisons
- `_in`, `_nin` - in array, not in array
- `_contains` - substring match
- `_starts_with` - prefix match

**Logical operators:**

```http
GET /items/post?filter={"_or":[{"status":"published"},{"status":"archived"}]}
```

**Nested filters (relations):**

```http
GET /items/post?filter={"author":{"name":{"_contains":"john"}}}
```

**Complex example:**

```http
GET /items/post?filter={
  "_and": [
    {"status": {"_eq": "published"}},
    {"_or": [
      {"views": {"_gt": 1000}},
      {"author": {"role": {"_eq": "admin"}}}
    ]}
  ]
}
```

### Field Selection

Control which fields to return:

**All fields:**

```http
GET /items/post?fields=*
```

**Specific fields:**

```http
GET /items/post?fields=id,title,createdAt
```

**Include relation fields:**

```http
GET /items/post?fields=id,title,author.name,author.email
```

**Wildcard in relations:**

```http
GET /items/post?fields=*,author.*,comments.*
```

### Sorting

Use comma-separated field names. Prefix with `-` for descending:

```http
GET /items/post?sort=-createdAt,title
```

**Sort by relation field:**

```http
GET /items/post?sort=author.name
```

### Pagination

**Limit and offset:**

```http
GET /items/post?limit=10&offset=20
```

**Page-based:**

```http
GET /items/post?limit=10&page=3
```

### Deep Relations

Apply filters/sorting to nested relations:

```http
GET /items/post?deep[comments][_filter][status][_eq]=approved
GET /items/post?deep[comments][_sort]=-createdAt
GET /items/post?deep[comments][_limit]=5
```

## Complete Example

```http
GET /items/post?filter={"status":"published"}&fields=id,title,author.name,comments.*&sort=-createdAt&limit=20&deep[comments][_filter][status][_eq]=approved&deep[comments][_limit]=3
```

This query:

1. Filters posts by `status=published`
2. Returns only `id`, `title`, `author.name`, and all comment fields
3. Sorts by `createdAt` descending
4. Limits to 20 posts
5. For each post, includes only approved comments (max 3)

## Permissions & Security

### Collection-Level RBAC

Permissions are enforced at the **collection level**, not field level:

- `GET` requires `read` permission
- `POST` requires `create` permission
- `PATCH` requires `update` permission
- `DELETE` requires `delete` permission

**Row-level filtering** is automatically applied based on your role. For example:

- Anonymous users may only see `status=published` posts
- Regular users may only see their own user record
- Admins see everything

### Field Selection is NOT Permission-Controlled

If you have `read` permission on a collection, you can request **any field** via the `fields` parameter. Field-level permissions are not implemented.

## Common Errors

### 403 Forbidden

```json
{
  "statusCode": 403,
  "message": "Permission denied: read on post"
}
```

**Cause:** You don't have the required permission for this action.

### 400 Bad Request - Invalid Collection

```json
{
  "statusCode": 400,
  "message": "Collection xyz does not exist"
}
```

**Cause:** The collection name doesn't map to any registered entity.

### 400 Bad Request - Invalid Filter

```json
{
  "statusCode": 400,
  "message": "Filter must be valid JSON"
}
```

**Cause:** The `filter` parameter is not valid JSON.

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Item 123 in post not found"
}
```

**Cause:** The item doesn't exist, or you don't have permission to see it (row-level security).

## Tips

1. **URL-encode complex filters** when using them in GET requests
2. **Use POST body** for very complex queries if your client supports it
3. **Request only needed fields** to reduce payload size
4. **Combine filters** with logical operators for complex queries
5. **Test permissions** with different user roles to understand row-level filtering
