# Tài liệu Kiến trúc và Hướng dẫn sử dụng Backend

Tài liệu này mô tả kiến trúc của hệ thống backend, được thiết kế với mục tiêu linh hoạt, an toàn và có khả năng mở rộng cao, đồng thời hướng dẫn cách sử dụng và mở rộng hệ thống.

---

## 1. Tổng quan Kiến trúc

Hệ thống được xây dựng dựa trên NestJS và đi theo một kiến trúc hướng module, tách biệt rõ ràng các mối quan tâm (separation of concerns). Nền tảng này không chỉ là một boilerplate thông thường mà là một Headless CMS linh hoạt với các thành phần cốt lõi được thiết kế để trừu tượng hóa các tác vụ lặp lại và tăng cường bảo mật.

**Các thành phần chính bao gồm:**

1.  **Query Engine**: Trái tim của hệ thống, chịu trách nhiệm phân tích và thực thi các truy vấn động từ client.
2.  **Generic Items API**: Lớp giao tiếp chính, cung cấp các endpoint CRUD tự động cho mọi thực thể dữ liệu (entity).
3.  **Authentication & Authorization (RBAC)**: Module bảo mật, quản lý danh tính người dùng và kiểm soát quyền truy cập chi tiết.
4.  **Storage Service**: Cung cấp lớp trừu tượng cho việc lưu trữ và quản lý file.
5.  **Custom Endpoints Framework**: Cung cấp cấu trúc để xây dựng các endpoint với logic nghiệp vụ riêng.
6.  **Configuration Module**: Quản lý cấu hình ứng dụng một cách an toàn và linh hoạt.

---

## 2. Module: Query Engine

### 2.1. Mục đích

Query Engine là bộ não xử lý dữ liệu của hệ thống. Nó cung cấp một cơ chế truy vấn dữ liệu mạnh mẽ, linh hoạt và an toàn, cho phép client yêu cầu dữ liệu phức tạp (lọc, sắp xếp, lồng ghép) thông qua các tham số URL đơn giản mà không cần backend phải định nghĩa trước từng endpoint cụ thể.

### 2.2. Trách nhiệm

- **Phân tích (Parse)** các tham số truy vấn từ URL (`filter`, `sort`, `fields`, `limit`, `offset`, `page`, `deep`, `meta`) thành một cấu trúc dữ liệu trung gian là **AST (Abstract Syntax Tree)**.
- **Biên dịch (Compile)** AST thành câu lệnh truy vấn phù hợp với ORM (MikroORM).
- **Tự động áp dụng** các bộ lọc quyền (permission filters) từ module RBAC để đảm bảo người dùng chỉ thấy dữ liệu họ được phép.
- **Áp đặt** các giới hạn an toàn (query limits) để ngăn chặn các truy vấn có khả năng gây quá tải hệ thống.

### 2.3. Chi Tiết Các Tham Số Truy Vấn

#### **`filter`**: Lọc dữ liệu

Sử dụng `filter` với một đối tượng JSON để lọc kết quả.

- **So sánh bằng:**
  `GET /items/post?filter={"status":"published"}`

- **Toán tử so sánh:**
  `GET /items/post?filter={"views":{"_gte":100}}`
  - Các toán tử được hỗ trợ: `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte`, `_in`, `_nin`, `_contains`, `_starts_with`.

- **Toán tử logic (`_and`, `_or`):**
  `GET /items/post?filter={"_or":[{"status":"published"},{"status":"archived"}]}`

- **Lọc trên quan hệ lồng nhau:**
  `GET /items/post?filter={"author":{"name":{"_contains":"john"}}}`

#### **`fields`**: Lựa chọn trường dữ liệu

Kiểm soát các trường được trả về.

- **Tất cả các trường của entity chính:**
  `GET /items/post?fields=*`

- **Các trường cụ thể:**
  `GET /items/post?fields=id,title,createdAt`

- **Bao gồm các trường của quan hệ:**
  `GET /items/post?fields=id,title,author.name,author.email`

- **Sử dụng wildcard trên quan hệ:**
  `GET /items/post?fields=*,author.*,comments.*`

#### **`sort`**: Sắp xếp kết quả

Sử dụng danh sách các trường được phân tách bằng dấu phẩy. Thêm tiền tố `-` để sắp xếp giảm dần.

`GET /items/post?sort=-createdAt,title`

#### **`limit`, `offset`, `page`**: Phân trang

- **Giới hạn số lượng và bỏ qua:**
  `GET /items/post?limit=10&offset=20`

- **Dựa trên số trang:**
  `GET /items/post?limit=10&page=3`

#### **`deep`**: Lọc và sắp xếp trên quan hệ sâu

Áp dụng các tùy chọn truy vấn cho các collection lồng nhau.

`GET /items/post?deep[comments][_filter][status][_eq]=approved&deep[comments][_sort]=-createdAt`

#### **`meta`**: Lấy thông tin metadata

Yêu cầu dữ liệu metadata về số lượng bản ghi cùng với kết quả.

- `meta=filter_count`: Trả về số lượng bản ghi khớp với điều kiện `filter` (bỏ qua phân trang).
- `meta=total_count`: Trả về tổng số bản ghi trong collection (bỏ qua `filter` và phân trang).
- `meta=*`: Trả về cả hai.

**Ví dụ:**
`GET /items/post?filter={"status":"published"}&meta=*`

**Phản hồi:**

```json
{
  "data": [
    /* các bài post đã published */
  ],
  "meta": {
    "filter_count": 45,
    "total_count": 150
  }
}
```

### 2.4. Rủi ro / Lưu ý

- **Độ phức tạp của truy vấn**: Cần theo dõi và tối ưu hiệu suất cho các truy vấn phức tạp. Luôn đảm bảo các cột dữ liệu được filter thường xuyên đã được đánh index.
- **Truy vấn quá sâu**: Các truy vấn lồng nhau quá nhiều cấp có thể gây ra vấn đề N+1. QueryEngine đã có cơ chế giới hạn độ sâu truy vấn (mặc định là 3).

---

## 3. Module: Generic Items API

### 3.1. Mục đích

Cung cấp một bộ API RESTful chung cho tất cả các thực thể đã đăng ký, giúp giảm thiểu việc viết code lặp lại cho các thao tác CRUD. Tên `collection` trong URL là **tên bảng** trong CSDL (thường là số ít, viết thường).

### 3.2. Các Endpoint

- `GET /items/:collection`
- `GET /items/:collection/:id`
- `POST /items/:collection`
- `PATCH /items/:collection/:id`
- `DELETE /items/:collection/:id`

### 3.3. Ví Dụ Sử Dụng API

**Lấy danh sách:**
`GET /items/post?fields=id,title&sort=-createdAt`

**Lấy một item:**
`GET /items/post/123`

**Tạo mới:**

```http
POST /items/post
Content-Type: application/json

{
  "title": "Hello World",
  "content": "Đây là nội dung bài viết."
}
```

**Cập nhật:**

```http
PATCH /items/post/123
Content-Type: application/json

{
  "status": "published"
}
```

**Xóa:**
`DELETE /items/post/123`

### 3.4. Rủi ro / Lưu ý

- **Field-level security**: Module này không hỗ trợ kiểm soát quyền ở cấp độ trường. Nếu một vai trò có quyền `read` trên một collection, họ có thể yêu cầu bất kỳ trường nào.
- **Tên collection**: Tên `collection` trong URL là tên bảng trong CSDL (thường là dạng số ít, viết thường), không phải tên class của Entity.

---

## 4. Module: Authentication & Authorization (RBAC)

### 4.1. Mục đích

Đảm bảo chỉ người dùng hợp lệ mới có thể truy cập hệ thống và họ chỉ có thể thực hiện các hành động được cấp phép.

### 4.2. Luồng chính

- **Authentication**: Xác thực qua email/password, cấp cặp Access Token (JWT, ngắn hạn) và Refresh Token (dài hạn, lưu trong CSDL).
- **Authorization**: `PermissionService` kiểm tra quyền của người dùng dựa trên vai trò (Role) và các quyền (Permission) được gán cho vai trò đó trong CSDL.

### 4.3. Điểm mở rộng: Thêm hành động (Action) mới

Mô hình RBAC cho phép thêm các "hành động" tùy chỉnh một cách linh hoạt mà không cần sửa code của `PermissionService`.

1.  **Sử dụng action mới trong code**:
    Trong một service, gọi `assert` với một chuỗi action tùy ý.

    ```typescript
    // src/services/reports.service.ts
    async exportData(collection: string, query: any) {
      // Sử dụng một action tùy chỉnh là 'export_csv'
      this.permissionService.assert(collection, 'export_csv');
      // ... logic xuất dữ liệu
    }
    ```

2.  **Định nghĩa quyền trong CSDL**:
    Trong bảng `permission`, tạo một bản ghi mới:
    - `collection`: "post"
    - `action`: "export_csv"

3.  **Gán quyền cho vai trò**:
    Gán quyền vừa tạo cho một vai trò (ví dụ: "analyst") trong bảng gán quyền-vai trò.

---

## 5. Module: Storage Service

Cung cấp một lớp trừu tượng (`IStorageAdapter`) cho việc quản lý file, giúp ứng dụng không bị phụ thuộc vào một nhà cung cấp lưu trữ cụ thể (local, S3, GCS...). Việc chuyển đổi giữa các nhà cung cấp chỉ cần thay đổi biến môi trường `STORAGE_DRIVER`.

---

## 6. Module: Custom Endpoints & Mở rộng

Cung cấp cấu trúc chuẩn hóa để xây dựng các API có logic nghiệp vụ phức tạp.

### Quy trình xây dựng Custom Endpoint

Luôn tuân theo quy trình: **Controller → Service → QueryEngine/Repository**.

**1. Tạo Controller**:
Controller chỉ chịu trách nhiệm định nghĩa route, nhận request và gọi service. **Không chứa logic nghiệp vụ.**

```typescript
// src/controllers/reports.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from '../services/reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('active-users')
  async getActiveUsers(@Query() query: any) {
    // Ủy quyền hoàn toàn cho Service
    return this.reportsService.getActiveUsers(query);
  }
}
```

**2. Tạo Service**:
Service là nơi chứa toàn bộ logic nghiệp vụ.

```typescript
// src/services/reports.service.ts
import { Injectable } from '@nestjs/common';
import { QueryEngineService } from '../query/query-engine.service';
import { GenericRepository } from '../repository/generic.repository';
import { PermissionService } from '../common/permissions/permission.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly queryEngine: QueryEngineService,
    private readonly repository: GenericRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async getActiveUsers(query: any) {
    // 1. Luôn kiểm tra quyền trước tiên
    this.permissionService.assert('reports', 'generate');

    // 2. Tái sử dụng QueryEngine để phân tích các tham số từ client (filter, sort...)
    const options = await this.queryEngine.parseAndCompile({
      collection: 'user',
      query: query,
    });

    // 3. Thêm logic nghiệp vụ tùy chỉnh
    // Ví dụ: chỉ lấy user hoạt động trong 30 ngày gần nhất
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    options.where = {
      $and: [
        options.where, // Giữ lại các filter từ client
        { status: 'active' },
        { lastLoginAt: { $gte: thirtyDaysAgo } },
      ],
    };

    // 4. Thực thi truy vấn qua GenericRepository
    return this.repository.find('user', options);
  }
}
```

**3. Đăng ký vào Module**:
Đăng ký `ReportsController` và `ReportsService` vào một module (ví dụ `AppModule` hoặc một `ReportsModule` riêng).

### Những điều BẮT BUỘC và KHÔNG ĐƯỢC làm

- ✅ **Luôn** gọi `permissionService.assert()` ở đầu mỗi phương thức service.
- ✅ **Luôn** tái sử dụng `queryEngine.parseAndCompile()` để hỗ trợ các tham số truy vấn từ client.
- ✅ **Luôn** thực thi truy vấn qua `GenericRepository`.
- ❌ **KHÔNG BAO GIỜ** truy cập trực tiếp vào `MikroORM` hay `EntityManager` từ controller hoặc service.
- ❌ **KHÔNG BAO GIỜ** đặt logic nghiệp vụ trong controller.

### Chuyên biệt hóa Endpoint với DTO (Quy trình được khuyến khích)

Khi bạn muốn thêm validation chặt chẽ cho các thao tác `create` và `update` trên một resource, thay vì tạo một custom endpoint hoàn toàn mới, bạn có thể "chuyên biệt hóa" (specialize) endpoint chung `/items/:collection`. Hệ thống cung cấp một script để tự động hóa quy trình này.

#### **Tự động tạo Controller và DTO với `generate-resource.sh`**

Script này giúp tạo nhanh các file cần thiết để áp dụng Data Transfer Objects (DTOs) cho việc validation.

**1. Mục đích**

Để nhanh chóng tạo validation cho body của request `POST` (create) và `PATCH` (update) trên một resource, đảm bảo dữ liệu đầu vào luôn đúng định dạng bạn mong muốn.

**2. Cách sử dụng**

Chạy script từ thư mục gốc của dự án với tên resource ở dạng `PascalCase` (số ít).

```bash
bash generate-resource.sh Product
```

**3. Các file được tạo**

Script sẽ tạo ra các file sau cho resource `Product`:

- `src/controllers/products.controller.ts`: Controller chuyên biệt.
- `src/dto/product/create-product.dto.ts`: DTO cho việc tạo mới.
- `src/dto/product/update-product.dto.ts`: DTO cho việc cập nhật.

**4. Luồng hoạt động**

- Controller mới (`ProductsController`) sẽ "ghi đè" các route `POST /items/product` và `PATCH /items/product/:id`.
- Khi một request `POST` hoặc `PATCH` đến các route này, NestJS sẽ dùng controller chuyên biệt này thay vì `ItemsController` chung.
- Nhờ đó, `ValidationPipe` của NestJS sẽ tự động được áp dụng lên body của request, sử dụng các quy tắc bạn định nghĩa trong `CreateProductDto` và `UpdateProductDto`.
- Các request `GET` và `DELETE` vẫn sẽ được xử lý bởi `ItemsController` chung như bình thường.

**5. Các bước tiếp theo (Rất quan trọng)**

Sau khi chạy script, bạn cần làm những việc sau:

1.  **Định nghĩa DTO**: Mở file `src/dto/product/create-product.dto.ts` và thêm các thuộc tính cùng với các decorator validation từ `class-validator` (ví dụ: `@IsString()`, `@IsNotEmpty()`, `@IsNumber()`).
2.  **Đăng ký Controller**: Mở file `app.module.ts` (hoặc module tương ứng) và **thêm `ProductsController` vào mảng `controllers`**. Nếu không có bước này, controller mới sẽ không hoạt động.

    ```typescript
    // app.module.ts
    import { ProductsController } from './controllers/products.controller';
    // ... các controller khác

    @Module({
      imports: [
        // ...
      ],
      controllers: [AppController, ProductsController, ItemsController, ...] // <--- Thêm vào đây lưu ý thứ tự controller chuyên biệt phải đứng trước controller chung
      providers: [
        // ...
      ],
    })
    export class AppModule {}
    ```

---

## 7. Mở Rộng Chức Năng Cốt Lõi

### 7.1. Thêm một Entity mới

1.  **Tạo file Entity**:

    ```typescript
    // src/database/entities/product.entity.ts
    import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

    @Entity()
    export class Product {
      @PrimaryKey()
      id!: number;

      @Property()
      name!: string;
    }
    ```

2.  **Đăng ký vào `mikro-orm.config.ts`**:

    ```typescript
    // mikro-orm.config.ts
    import { Product } from './entities/product.entity';

    export default defineConfig({
      entities: [User, Post, ..., Product], // Thêm vào đây
    });
    ```

3.  **Hoàn tất!** Hệ thống sẽ tự động tạo ra các endpoint `/items/product` cho bạn.

--- Tính năng định mở rộng --

### 7.2. Thêm Toán Tử Lọc Mới (ví dụ: `_between`)

1.  **Cập nhật `query.ast.ts`**:
    ```typescript
    // src/query/ast/query.ast.ts
    export type FilterOperator =
      | '_eq' | '_neq' | ...
      | '_between'; // Thêm toán tử mới
    ```
2.  **Cập nhật `where.compiler.ts`**:
    Thêm logic biên dịch cho toán tử mới.
    ```typescript
    // src/query/compiler/where.compiler.ts
    // trong hàm compileOperators
    switch (op as FilterOperator) {
      // ... các case khác
      case '_between':
        result['$gte'] = val[0];
        result['$lte'] = val[1];
        break;
    }
    ```
3.  **Sử dụng**:
    `GET /items/product?filter={"price":{"_between":[10,100]}}`

### 7.3. Thêm Tham Số Truy Vấn Mới (ví dụ: `search`)

1.  **Tạo một Parser mới**: `src/query/parser/search.parser.ts`.
2.  **Cập nhật `QueryEngineService`**: Tích hợp parser mới và thêm logic để áp dụng tham số `search` vào mệnh đề `where` của truy vấn (ví dụ: tìm kiếm trên nhiều trường `title`, `content`...).
3.  **Đăng ký Parser mới** vào `QueryModule`.
4.  **Sử dụng**: `GET /items/post?search=nestjs&sort=-createdAt`

---

## 8. Module: Configuration

Quản lý toàn bộ cấu hình ứng dụng qua các biến môi trường (`.env`).

- **KHÔNG BAO GIỜ** hardcode các giá trị nhạy cảm (secrets, passwords, keys) trong code.
- Sử dụng `ConfigService` để truy cập cấu hình một cách an toàn.
- Tham khảo file `.env.example` để biết tất cả các biến môi trường cần thiết cho dự án.
