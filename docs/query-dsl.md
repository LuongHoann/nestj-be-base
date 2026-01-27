# Query DSL Specification

This document describes the Domain Specific Language (DSL) used for querying the API. The Query Engine allows for advanced filtering, sorting, and pagination.

## Filtering (`filter`)

Pass a JSON object to the `filter` query parameter.

### Examples

**Equality**

```json
{ "status": "active" }
```

**Comparison**

```json
{ "age": { "$gt": 18, "$lte": 65 } }
```

**Logical Operators (AND/OR)**

```json
{
  "$or": [{ "role": "admin" }, { "role": "editor" }]
}
```

**Relation Filtering**

```json
{
  "author": {
    "name": { "$like": "John%" }
  }
}
```

### Supported Operators

- `$eq`: Equal (default)
- `$ne`: Not equal
- `$gt`, `$gte`: Greater than (or equal)
- `$lt`, `$lte`: Less than (or equal)
- `$like`: SQL Like style matching (`%term%`)
- `$in`, `$nin`: In array / Not in array
- `$null`: Is null (true/false)

## Sorting (`sort`)

Pass a JSON object to determine sort order.

### Examples

```json
{ "createdAt": "DESC", "title": "ASC" }
```

## Pagination

- `limit`: Number of items to return (default 10, max configurable)
- `offset` or `page`: Offset or Page number

## Limits & Safety

To ensure system stability, the following limits are enforced by default (can be overridden via Environment Variables):

- **Max Filter Depth:** 3 levels of nested relations.
- **Max Conditions:** 20 conditions per query.
- **Max Sort Fields:** 3 fields.
- **Regex:** Disabled by default for security (`$regex`).

## Not Supported (By Design)

- **Arbitrary Raw SQL:** For security, raw SQL is not allowed.
- **Unlimited Deep Nesting:** Prevents N+1 and performance degradation.
- **Regex ReDoS:** Unsafe regex patterns are blocked if regex is enabled.
