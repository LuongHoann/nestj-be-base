# Meta Query Parameter

## Overview

The `meta` query parameter allows you to request count metadata alongside your data queries.

## Syntax

```http
GET /items/:collection?meta=<value>
```

**Supported values:**

- `filter_count` - Count of records matching current filters (ignores pagination)
- `total_count` - Total count of all records in collection (ignores filters and pagination)
- `*` - Shorthand for both `filter_count` and `total_count`

**Multiple values:**

```http
?meta=filter_count,total_count
```

## Response Format

### Without Meta (Default)

```http
GET /items/post
```

**Response:**

```json
[
  { "id": 1, "title": "Post 1" },
  { "id": 2, "title": "Post 2" }
]
```

### With Meta

```http
GET /items/post?meta=filter_count
```

**Response:**

```json
{
  "data": [
    { "id": 1, "title": "Post 1" },
    { "id": 2, "title": "Post 2" }
  ],
  "meta": {
    "filter_count": 2
  }
}
```

### With All Meta Fields

```http
GET /items/post?meta=*
```

**Response:**

```json
{
  "data": [
    { "id": 1, "title": "Post 1" },
    { "id": 2, "title": "Post 2" }
  ],
  "meta": {
    "filter_count": 2,
    "total_count": 150
  }
}
```

## Examples

### Pagination with Count

```http
GET /items/post?limit=10&offset=20&meta=filter_count,total_count
```

**Response:**

```json
{
  "data": [
    /* 10 posts */
  ],
  "meta": {
    "filter_count": 150,
    "total_count": 150
  }
}
```

This tells you:

- You're viewing 10 posts (from the data array)
- There are 150 total posts matching your filters
- There are 150 total posts in the collection

### Filtered Query with Count

```http
GET /items/post?filter={"status":"published"}&meta=*
```

**Response:**

```json
{
  "data": [
    /* published posts */
  ],
  "meta": {
    "filter_count": 45,
    "total_count": 150
  }
}
```

This tells you:

- 45 posts are published (filter_count)
- 150 total posts exist (total_count)

### Complex Filter with Pagination

```http
GET /items/post?filter={"author":{"role":"admin"}}&limit=5&meta=filter_count
```

**Response:**

```json
{
  "data": [
    /* 5 posts */
  ],
  "meta": {
    "filter_count": 23
  }
}
```

This tells you:

- You're viewing the first 5 posts
- There are 23 total posts by admin authors

## Semantic Differences

### `filter_count`

- **Includes:** All filters (including permission filters)
- **Ignores:** Pagination (`limit`, `offset`)
- **Use case:** "How many records match my search?"

### `total_count`

- **Includes:** Nothing (base entity count)
- **Ignores:** Filters, pagination, sorting
- **Use case:** "How many total records exist?"

## Performance Considerations

**Counts are executed as separate queries:**

- `filter_count` → `SELECT COUNT(*) WHERE <filters>`
- `total_count` → `SELECT COUNT(*)`

**Optimization tips:**

1. Only request counts you need
2. Use `filter_count` for paginated lists
3. Use `total_count` sparingly (can be expensive on large tables)
4. Consider caching `total_count` if it doesn't change frequently

## Error Handling

### Invalid Meta Value

```http
GET /items/post?meta=invalid_value
```

**Response:**

```json
{
  "statusCode": 400,
  "message": "Invalid meta value: \"invalid_value\". Supported values: filter_count, total_count, *"
}
```

### Empty Meta Value

```http
GET /items/post?meta=
```

**Behavior:** Ignored (same as no meta parameter)

## Backward Compatibility

**Queries without `meta` parameter are unchanged:**

```http
GET /items/post
```

Returns array directly (not wrapped in `{ data, meta }`).

**This ensures existing clients continue to work.**

## Use Cases

### Building Paginated Tables

```http
GET /items/post?limit=20&page=1&meta=filter_count
```

Use `filter_count` to calculate total pages:

```javascript
const totalPages = Math.ceil(meta.filter_count / limit);
```

### Search Results

```http
GET /items/post?filter={"title":{"_contains":"nestjs"}}&meta=filter_count
```

Display: "Found 12 results for 'nestjs'"

### Dashboard Statistics

```http
GET /items/user?meta=total_count
GET /items/post?filter={"status":"published"}&meta=filter_count
```

Display:

- Total users: 1,234
- Published posts: 567

### Infinite Scroll

```http
GET /items/post?limit=20&offset=0&meta=filter_count
```

Keep loading until `data.length + offset >= meta.filter_count`
