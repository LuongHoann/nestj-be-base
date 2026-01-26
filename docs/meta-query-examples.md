# Meta Query Examples

## Test Scenarios

### 1. Basic Count Request

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=filter_count"
```

**Expected Response:**

```json
{
  "data": [
    { "id": 1, "title": "First Post", "status": "published" },
    { "id": 2, "title": "Second Post", "status": "draft" }
  ],
  "meta": {
    "filter_count": 2
  }
}
```

---

### 2. Total Count Only

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=total_count"
```

**Expected Response:**

```json
{
  "data": [
    /* all posts */
  ],
  "meta": {
    "total_count": 150
  }
}
```

---

### 3. Both Counts (Wildcard)

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=*"
```

**Expected Response:**

```json
{
  "data": [
    /* all posts */
  ],
  "meta": {
    "filter_count": 150,
    "total_count": 150
  }
}
```

---

### 4. Filtered Query with Count

**Request:**

```bash
curl "http://localhost:3000/items/post?filter={\"status\":\"published\"}&meta=*"
```

**Expected Response:**

```json
{
  "data": [
    /* published posts only */
  ],
  "meta": {
    "filter_count": 45,
    "total_count": 150
  }
}
```

**Interpretation:**

- 45 posts are published
- 150 total posts exist in database

---

### 5. Pagination with Count

**Request:**

```bash
curl "http://localhost:3000/items/post?limit=10&offset=20&meta=filter_count"
```

**Expected Response:**

```json
{
  "data": [
    /* 10 posts starting from offset 20 */
  ],
  "meta": {
    "filter_count": 150
  }
}
```

**Interpretation:**

- Showing posts 21-30
- 150 total posts available
- Can calculate: 15 pages total (150 / 10)

---

### 6. Complex Filter + Pagination

**Request:**

```bash
curl "http://localhost:3000/items/post?filter={\"author\":{\"role\":\"admin\"}}&limit=5&meta=*"
```

**Expected Response:**

```json
{
  "data": [
    /* 5 posts by admin authors */
  ],
  "meta": {
    "filter_count": 23,
    "total_count": 150
  }
}
```

**Interpretation:**

- Showing first 5 of 23 posts by admins
- 150 total posts in database

---

### 7. No Meta (Backward Compatible)

**Request:**

```bash
curl "http://localhost:3000/items/post"
```

**Expected Response:**

```json
[
  { "id": 1, "title": "First Post" },
  { "id": 2, "title": "Second Post" }
]
```

**Note:** No `meta` wrapper - returns array directly.

---

### 8. Multiple Meta Values (Comma-Separated)

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=filter_count,total_count"
```

**Expected Response:**

```json
{
  "data": [
    /* posts */
  ],
  "meta": {
    "filter_count": 150,
    "total_count": 150
  }
}
```

---

### 9. Error: Invalid Meta Value

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=invalid"
```

**Expected Response:**

```json
{
  "statusCode": 400,
  "message": "Invalid meta value: \"invalid\". Supported values: filter_count, total_count, *"
}
```

---

### 10. Empty Meta (Ignored)

**Request:**

```bash
curl "http://localhost:3000/items/post?meta="
```

**Expected Response:**

```json
[{ "id": 1, "title": "First Post" }]
```

**Note:** Empty meta is ignored, returns array directly.

---

## Frontend Integration Examples

### React Pagination Component

```typescript
const [posts, setPosts] = useState([]);
const [totalCount, setTotalCount] = useState(0);
const [page, setPage] = useState(1);
const limit = 20;

useEffect(() => {
  fetch(
    `/items/post?limit=${limit}&offset=${(page - 1) * limit}&meta=filter_count`,
  )
    .then((res) => res.json())
    .then((response) => {
      setPosts(response.data);
      setTotalCount(response.meta.filter_count);
    });
}, [page]);

const totalPages = Math.ceil(totalCount / limit);
```

### Vue.js Search Results

```vue
<template>
  <div>
    <p>Found {{ meta.filter_count }} of {{ meta.total_count }} posts</p>
    <div v-for="post in data" :key="post.id">
      {{ post.title }}
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      data: [],
      meta: {},
    };
  },
  async mounted() {
    const response = await fetch(
      '/items/post?filter={"status":"published"}&meta=*',
    );
    const result = await response.json();
    this.data = result.data;
    this.meta = result.meta;
  },
};
</script>
```

### Angular Infinite Scroll

```typescript
export class PostListComponent {
  posts: Post[] = [];
  offset = 0;
  limit = 20;
  filterCount = 0;
  hasMore = true;

  async loadMore() {
    const response = await fetch(
      `/items/post?limit=${this.limit}&offset=${this.offset}&meta=filter_count`,
    );
    const result = await response.json();

    this.posts.push(...result.data);
    this.filterCount = result.meta.filter_count;
    this.offset += this.limit;
    this.hasMore = this.posts.length < this.filterCount;
  }
}
```

---

## Performance Testing

### Scenario 1: Small Dataset (100 records)

```bash
# Without meta
curl "http://localhost:3000/items/post"
# Response time: ~50ms

# With filter_count
curl "http://localhost:3000/items/post?meta=filter_count"
# Response time: ~55ms (+5ms for COUNT query)

# With both counts
curl "http://localhost:3000/items/post?meta=*"
# Response time: ~60ms (+10ms for 2 COUNT queries)
```

### Scenario 2: Large Dataset (100,000 records)

```bash
# Without meta
curl "http://localhost:3000/items/post?limit=20"
# Response time: ~50ms

# With filter_count
curl "http://localhost:3000/items/post?limit=20&meta=filter_count"
# Response time: ~80ms (+30ms for COUNT on large table)

# With indexed filter + count
curl "http://localhost:3000/items/post?filter={\"status\":\"published\"}&meta=filter_count"
# Response time: ~70ms (indexed column)
```

**Recommendation:** Only request counts when needed for UI (pagination, search results).
