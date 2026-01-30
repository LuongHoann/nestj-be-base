This file is a merged representation of the entire codebase, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
.gitignore
.prettierrc
docs/api-usage.md
docs/custom-api.md
docs/extending-endpoints.md
docs/huong_dan.md
docs/meta-queries.md
docs/meta-query-examples.md
docs/query-dsl.md
docs/RBAC_ACTIONS.md
docs/RBAC.md
eslint.config.mjs
mikro-orm.config.ts
nest-cli.json
package.json
src/app.controller.spec.ts
src/app.controller.ts
src/app.module.ts
src/app.service.ts
src/auth/auth.controller.ts
src/auth/auth.module.ts
src/auth/auth.service.ts
src/auth/decorators/current-user.decorator.ts
src/auth/dto/login.dto.ts
src/auth/dto/reset-password.dto.ts
src/auth/guards/jwt-auth.guard.ts
src/auth/strategies/jwt.strategy.ts
src/common/common.module.ts
src/common/context/request.context.ts
src/common/exceptions/invalid-query.exception.ts
src/common/permissions/permission.service.ts
src/config/auth.config.ts
src/config/database.config.ts
src/config/query.config.ts
src/config/storage.config.ts
src/controllers/items.controller.ts
src/controllers/reports.controller.ts
src/database/entities/comment.entity.ts
src/database/entities/file.entity.ts
src/database/entities/permission.entity.ts
src/database/entities/post.entity.ts
src/database/entities/refresh-token.entity.ts
src/database/entities/reset-password-token.entity.ts
src/database/entities/role.entity.ts
src/database/entities/user.entity.ts
src/database/migrations/.snapshot-postgres.json
src/database/migrations/Migration20260116000000_InitialSchema.ts
src/database/migrations/Migration20260116012800.ts
src/database/migrations/Migration20260116094900_TokenTables.ts
src/database/migrations/Migration20260124030806.ts
src/files/dto/commit-file.dto.ts
src/files/dto/temp-upload-response.dto.ts
src/files/files.controller.ts
src/files/files.module.ts
src/files/files.scheduler.ts
src/files/files.service.ts
src/main.ts
src/meta/entity-registry.service.ts
src/meta/meta.module.ts
src/meta/metadata-reader.service.ts
src/query/ast/query.ast.ts
src/query/compiler/fields.compiler.ts
src/query/compiler/order.compiler.ts
src/query/compiler/where.compiler.ts
src/query/parser/deep.parser.ts
src/query/parser/fields.parser.ts
src/query/parser/filter.parser.ts
src/query/parser/meta.parser.ts
src/query/parser/pagination.parser.ts
src/query/parser/sort.parser.ts
src/query/query-engine.service.spec.ts
src/query/query-engine.service.ts
src/query/query.module.ts
src/repository/generic.repository.ts
src/repository/repository.module.ts
src/services/items.service.ts
src/services/reports.service.ts
src/services/services.module.ts
src/storage/local-storage.adapter.ts
src/storage/storage.interface.ts
src/storage/storage.service.ts
storage/temp/01KFQ0PEXVFWHRZ9ZFDM75E8DZ
storage/temp/01KFQ1GENRTN714S1EQM13ZJJ1
storage/uploads/01KFQ3SQA8JEBXYGP6AZNJBNZ8
storage/uploads/f2efddd8-26e6-4ad8-89ae-eef6e40a33b8
test/app.e2e-spec.ts
test/jest-e2e.json
tsconfig.build.json
tsconfig.json
```

# Files

## File: docs/huong_dan.md
````markdown
Tài liệu Kiến trúc Backend

  Tài liệu này mô tả kiến trúc của hệ thống backend, được thiết kế với mục tiêu linh hoạt, an toàn và có khả năng mở rộng cao.

  1. Tổng quan Kiến trúc

  Hệ thống được xây dựng dựa trên NestJS và đi theo một kiến trúc hướng module, tách biệt rõ ràng các mối quan tâm (separation of concerns). Nền tảng này 
  không chỉ là một boilerplate thông thường mà là một Headless CMS linh hoạt với các thành phần cốt lõi được thiết kế để trừu tượng hóa các tác vụ lặp lại  và tăng cường bảo mật.

  Các thành phần chính bao gồm:

   1. Query Engine: Trái tim của hệ thống, chịu trách nhiệm phân tích và thực thi các truy vấn động từ client.
   2. Generic Items API: Lớp giao tiếp chính, cung cấp các endpoint CRUD tự động cho mọi thực thể dữ liệu (entity).
   3. Authentication & Authorization (RBAC): Module bảo mật, quản lý danh tính người dùng và kiểm soát quyền truy cập chi tiết.
   4. Storage Service: Cung cấp lớp trừu tượng cho việc lưu trữ và quản lý file.
   5. Custom Endpoints Framework: Cung cấp cấu trúc để xây dựng các endpoint với logic nghiệp vụ riêng.
   6. Configuration Module: Quản lý cấu hình ứng dụng một cách an toàn và linh hoạt.

  ---

  2. Module: Query Engine

  2.1. Mục đích

  Query Engine là bộ não xử lý dữ liệu của hệ thống. Nó được tạo ra để cung cấp một cơ chế truy vấn dữ liệu mạnh mẽ, linh hoạt và an toàn, cho phép client  yêu cầu dữ liệu phức tạp (lọc, sắp xếp, lồng ghép) thông qua các tham số URL đơn giản mà không cần backend phải định nghĩa trước từng endpoint cụ thể.  

  2.2. Trách nhiệm

   * Phân tích (Parse) các tham số truy vấn từ URL (filter, sort, fields, limit, offset, page, deep, meta) thành một cấu trúc dữ liệu trung gian là AST
     (Abstract Syntax Tree).
   * Biên dịch (Compile) AST thành câu lệnh truy vấn phù hợp với ORM (MikroORM).
   * Tự động áp dụng các bộ lọc quyền (permission filters) từ module RBAC để đảm bảo người dùng chỉ thấy dữ liệu họ được phép.
   * Áp đặt các giới hạn an toàn (query limits) để ngăn chặn các truy vấn có khả năng gây quá tải hệ thống (DoS).

  2.3. Luồng chính

   1. Input: Một object chứa các tham số query từ HTTP request (req.query).
   2. Parsing: Mỗi tham số (filter, sort...) được xử lý bởi một Parser riêng biệt (FilterParser, SortParser...) để chuyển đổi thành các node trong cây 
      AST.
   3. Permission Integration: QueryEngine gọi PermissionService để lấy các điều kiện lọc (row-level security) tương ứng với vai trò của người dùng. Các
      điều kiện này được tích hợp vào cây AST.
   4. Compiling: Các Compiler (WhereCompiler, OrderCompiler...) duyệt cây AST và xây dựng thành một object FindOptions mà MikroORM có thể hiểu được.   
   5. Execution: GenericRepository nhận FindOptions và thực thi truy vấn lên cơ sở dữ liệu.
   6. Output: Dữ liệu trả về cho client.

  2.4. Điểm mở rộng

   * Thêm toán tử lọc mới:
       1. Định nghĩa toán tử trong query.ast.ts (ví dụ: _between).       
       2. Bổ sung logic xử lý cho toán tử mới trong where.compiler.ts.   
   * Thêm tham số truy vấn mới:
       1. Tạo một Parser mới (ví dụ: search.parser.ts).
       2. Tích hợp Parser này vào luồng xử lý của QueryEngineService.    
       3. Thêm logic để áp dụng kết quả parse vào câu truy vấn cuối cùng.

  2.5. Rủi ro / Lưu ý

   * Tấn công ReDoS: Nếu cho phép sử dụng Regex ($regex) trong filter mà không có kiểm soát, kẻ tấn công có thể đưa vào các biểu thức Regex phức tạp gây
     treo hệ thống. Mặc định, tính năng này đã bị vô hiệu hóa (QUERY_ALLOW_REGEX=false).
   * Truy vấn quá sâu: Các truy vấn lồng nhau quá nhiều cấp có thể gây ra vấn đề N+1 và làm chậm hệ thống. QueryEngine đã có cơ chế giới hạn độ sâu truy
     vấn (QUERY_MAX_DEPTH, mặc định là 3).
   * Độ phức tạp của truy vấn: Cần theo dõi và tối ưu hiệu suất cho các truy vấn phức tạp. Luôn đảm bảo các cột dữ liệu được filter thường xuyên đã được
     đánh index.

  ---

  3. Module: Generic Items API

  3.1. Mục đích

  Cung cấp một bộ API RESTful chung cho tất cả các thực thể dữ liệu đã đăng ký trong hệ thống, giúp giảm thiểu việc phải viết code lặp lại cho các thao
  tác CRUD cơ bản.

  3.2. Trách nhiệm

   * Định nghĩa các route chung:
       * GET /items/:collection
       * GET /items/:collection/:id
       * POST /items/:collection
       * PATCH /items/:collection/:id
       * DELETE /items/:collection/:id
   * Tiếp nhận HTTP request, xác định :collection và chuyển tiếp toàn bộ tham số truy vấn đến Query Engine.
   * Ánh xạ các phương thức HTTP tới các hành động RBAC tương ứng (GET -> read, POST -> create, ...).      

  3.3. Luồng chính

   1. Một request đến GET /items/post?filter={"status":"published"}.
   2. ItemsController tiếp nhận, xác định collection là post.
   3. ItemsController gọi ItemsService.find('post', req.query).
   4. ItemsService gọi QueryEngine để phân tích và biên dịch req.query.      
   5. QueryEngine trả về FindOptions đã được xử lý (bao gồm cả filter quyền).
   6. ItemsService sử dụng GenericRepository để thực thi truy vấn.
   7. Kết quả được trả về cho client.

  3.4. Điểm mở rộng

   * Bản thân module này được thiết kế để không cần mở rộng. Thay vào đó, khi cần logic phức tạp hơn, bạn nên tạo một Custom Endpoint mới.
   * Để đăng ký một collection mới, chỉ cần tạo Entity và thêm vào mikro-orm.config.ts. API sẽ tự động được tạo ra.

  3.5. Rủi ro / Lưu ý

   * Field-level security: Module này không hỗ trợ kiểm soát quyền ở cấp độ trường dữ liệu. Nếu một vai trò có quyền read trên một collection, họ có thể
     yêu cầu bất kỳ trường nào (trừ các trường đã được ẩn ở mức entity như password).
   * Tên collection: Tên collection trong URL là tên bảng trong CSDL (thường là dạng số ít, viết thường), không phải tên class của Entity.

  ---

  4. Module: Authentication & Authorization (RBAC)

  4.1. Mục đích

  Đảm bảo chỉ những người dùng hợp lệ mới có thể truy cập hệ thống, và họ chỉ có thể thực hiện các hành động mà họ được cấp phép.

  4.2. Trách nhiệm

   * Authentication: Xác thực người dùng (login, JWT, refresh token).
   * Authorization: Kiểm tra quyền hạn của người dùng đối với một hành động trên một tài nguyên cụ thể.
   * Quản lý vai trò (Role) và quyền (Permission) trong cơ sở dữ liệu.
   * Cung cấp PermissionService cho các module khác sử dụng để kiểm tra quyền.

  4.3. Luồng chính

  Luồng xác thực (Authentication)

   1. User gửi email + password đến /auth/login.
   2. AuthService xác thực thông tin. Nếu thành công, tạo ra một cặp Access Token (JWT) và Refresh Token.
   3. Access Token chứa thông tin user (payload) và có thời gian sống ngắn.
   4. Refresh Token có thời gian sống dài hơn, được lưu vào CSDL và dùng để cấp lại Access Token mới.
   5. Split-Token Strategy: Refresh Token được lưu một cách an toàn. tokenId và tokenSecret được băm (hashed) riêng, giảm thiểu rủi ro nếu CSDL bị lộ.

  Luồng kiểm tra quyền (Authorization)

   1. PermissionService.assert('post', 'publish') được gọi trong một service.
   2. Service lấy thông tin người dùng hiện tại từ RequestContext.
   3. Tải danh sách các vai trò (roles) của người dùng.
   4. Tải tất cả các quyền (permissions) tương ứng với các vai trò đó.
   5. Kiểm tra xem có quyền nào khớp với cặp collection='post' và action='publish' không.
   6. Nếu không tìm thấy -> ném lỗi ForbiddenException. Nếu tìm thấy -> cho phép thực hiện tiếp.

  4.4. Điểm mở rộng

   * Thêm hành động (Action) mới:
       1. Chỉ cần sử dụng một chuỗi action mới trong PermissionService.assert('reports', 'export_pdf').
       2. Sau đó, trong CSDL (bảng permission), tạo một bản ghi mới với collection='reports' và action='export_pdf'.
       3. Gán quyền này cho một vai trò.
       * Mô hình này không yêu cầu thay đổi code của PermissionService để thêm action mới.

  4.5. Rủi ro / Lưu ý

   * Quản lý vai trò: Việc quản lý vai trò và quyền hạn hiện cần được thực hiện trực tiếp trong CSDL hoặc thông qua các script. Hệ thống chưa có giao diện     admin cho việc này.
   * Caching: PermissionService có thể được tối ưu bằng cách cache lại thông tin quyền của người dùng (ví dụ: qua Redis) để giảm số lượng truy vấn CSDL   
     trong mỗi request.

  ---

  5. Module: Storage Service

  5.1. Mục đích

  Cung cấp một lớp trừu tượng (abstraction layer) cho việc quản lý file, giúp ứng dụng không bị phụ thuộc vào một nhà cung cấp lưu trữ cụ thể (local, S3,
  Google Cloud Storage...).

  5.2. Trách nhiệm

   * Định nghĩa một interface chung (IStorageAdapter) cho các thao tác với file: upload, delete, getSignedUrl...    
   * Cung cấp một StorageService để các module khác sử dụng, service này sẽ gọi đến adapter tương ứng được cấu hình.

  5.3. Luồng chính

   1. Trong file cấu hình, STORAGE_DRIVER được thiết lập (ví dụ: local hoặc s3).
   2. StorageService khởi tạo adapter tương ứng (ví dụ LocalStorageAdapter).
   3. Khi FilesService cần upload một file, nó sẽ gọi storageService.upload(file).
   4. StorageService chỉ đơn giản là gọi this.adapter.upload(file), toàn bộ logic xử lý cụ thể nằm trong adapter.

  5.4. Điểm mở rộng

   * Thêm nhà cung cấp lưu trữ mới (ví dụ: S3):
       1. Tạo một class S3StorageAdapter implement IStorageAdapter.
       2. Triển khai các phương thức upload, delete... bằng cách sử dụng AWS SDK.
       3. Cập nhật logic trong StorageService để khởi tạo S3StorageAdapter khi STORAGE_DRIVER=s3.

  5.5. Rủi ro / Lưu ý

   * Xử lý file lớn: Adapter cần được implement để xử lý file lớn một cách hiệu quả, ví dụ sử dụng stream để tránh tiêu thụ quá nhiều bộ nhớ.
     LocalStorageAdapter hiện tại đã làm tốt điều này.
   * Bảo mật: Khi tạo các URL có chữ ký (signed URL), cần đảm bảo chúng có thời gian hết hạn ngắn và chỉ cấp quyền tối thiểu cần thiết.      

  ---

  6. Module: Custom Endpoints & Mở rộng

  6.1. Mục đích

  Cung cấp một cấu trúc chuẩn hóa để xây dựng các API có logic nghiệp vụ phức tạp mà Generic Items API không thể đáp ứng.

  6.2. Trách nhiệm

   * Định nghĩa một quy trình rõ ràng để tạo controller, service cho các tính năng mới.
   * Khuyến khích việc tái sử dụng các module cốt lõi như QueryEngineService và PermissionService.

  6.3. Luồng chính (Ví dụ: API Report)

   1. Controller (`ReportsController`):
       * Định nghĩa route (ví dụ: @Get('active-users')).
       * Chỉ có trách nhiệm nhận request và gọi service tương ứng, không chứa logic nghiệp vụ.
   2. Service (`ReportsService`):
       * Inject QueryEngineService, PermissionService, GenericRepository.
       * Kiểm tra quyền: Gọi this.permissionService.assert('reports', 'generate') để đảm bảo người dùng có quyền thực hiện hành động này.       
       * Tái sử dụng Query Engine: Gọi this.queryEngine.parseAndCompile() để xử lý các tham số filter, sort... từ client.
       * Thêm logic nghiệp vụ: Thêm các điều kiện lọc tùy chỉnh vào kết quả từ Query Engine (ví dụ: chỉ lấy user active trong 30 ngày gần nhất).
       * Thực thi truy vấn: Gọi this.repository.find() với các options đã được xử lý.
       * Tính toán/Tổng hợp: Xử lý kết quả trả về (tính tổng, trung bình...).

  6.4. Điểm mở rộng

  Đây chính là module dùng để mở rộng hệ thống. Bất kỳ tính năng mới nào cũng nên được xây dựng theo mô hình này.

  6.5. Rủi ro / Lưu ý

   * KHÔNG BAO GIỜ bỏ qua PermissionService. Mọi custom endpoint phải có bước kiểm tra quyền.
   * KHÔNG BAO GIỜ truy cập trực tiếp vào ORM (EntityManager) từ controller hoặc service. Luôn sử dụng GenericRepository.
   * Tận dụng tối đa QueryEngine để client có thể lọc/sắp xếp trên kết quả của custom API, giúp API của bạn trở nên linh hoạt hơn.

  ---

  7. Module: Configuration

  7.1. Mục đích

  Quản lý toàn bộ cấu hình ứng dụng một cách an toàn, linh hoạt và nhất quán, đặc biệt là các thông tin nhạy cảm như mật khẩu CSDL, secret key...

  7.2. Trách nhiệm

   * Đọc cấu hình từ các biến môi trường (.env).
   * Cung cấp một ConfigService để các module khác có thể truy cập cấu hình một cách an toàn.        
   * Cung cấp các giá trị mặc định (fallback) an toàn cho các cấu hình quan trọng.
   * Xác thực và chuyển đổi kiểu dữ liệu cho các biến môi trường (ví dụ: PORT từ string sang number).

  7.3. Luồng chính

   1. Khi ứng dụng khởi động, ConfigModule (của NestJS) sẽ tải file .env.
   2. Các file cấu hình riêng (ví dụ: database.config.ts, auth.config.ts) đăng ký với ConfigModule và định nghĩa các biến mà chúng cần.
   3. Trong một service, ví dụ DatabaseService, thay vì đọc process.env.DB_HOST trực tiếp, nó sẽ inject ConfigService và gọi
      this.configService.get('database.host').

  7.4. Điểm mở rộng

   * Khi thêm một module mới cần cấu hình, tạo một file my-module.config.ts và đăng ký nó.

  7.5. Rủi ro / Lưu ý

   * Không bao giờ hardcode các giá trị nhạy cảm (secrets, passwords, keys) trong code. Luôn luôn sử dụng biến môi trường.
   * Cần có một file .env.example để ghi lại tất cả các biến môi trường cần thiết cho dự án, giúp người mới dễ dàng cài đặt.
````

## File: .gitignore
````
# compiled output
/dist
/node_modules
/build

# Logs
logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# OS
.DS_Store

# Tests
/coverage
/.nyc_output

# IDEs and editors
/.idea
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# IDE - VSCode
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json

# dotenv environment variable files
.env
.env.development.local
.env.test.local
.env.production.local
.env.local

# temp directory
.temp
.tmp

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Diagnostic reports (https://nodejs.org/api/report.html)
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json
````

## File: .prettierrc
````
{
  "singleQuote": true,
  "trailingComma": "all"
}
````

## File: docs/api-usage.md
````markdown
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
````

## File: docs/custom-api.md
````markdown
# Building Custom APIs

## When to Create a Custom API

Use custom APIs when:

- You need business logic beyond simple CRUD
- You're combining data from multiple collections
- You need custom permissions (e.g., `generate_report`, `approve`)
- You're creating computed/aggregated views
- The generic `/items/:collection` pattern doesn't fit

**Don't** create custom APIs for:

- Simple filtering or sorting (use query parameters)
- Field selection (use `fields` parameter)
- Standard CRUD operations

## Required Layers

Custom APIs follow the same architecture as generic APIs:

```
Controller (HTTP) → Service (Business Logic) → QueryEngine + Repository (Data)
```

**Never** access the ORM directly from controllers or services.

## Step-by-Step Example

### 1. Create the Controller

```typescript
// src/controllers/reports.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from '../services/reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('active-users')
  async getActiveUsers(@Query() query: any) {
    return this.reportsService.getActiveUsers(query);
  }

  @Get('sales-summary')
  async getSalesSummary(@Query() query: any) {
    return this.reportsService.getSalesSummary(query);
  }
}
```

**Controller responsibilities:**

- Define HTTP routes
- Extract query parameters
- Delegate to service
- **Nothing else**

### 2. Create the Service

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
    // 1. Check custom permission
    this.permissionService.assert('reports', 'generate');

    // 2. Parse user query (supports Directus-style params)
    const options = await this.queryEngine.parseAndCompile({
      collection: 'user',
      query: query,
    });

    // 3. Add custom business logic filter
    options.where = {
      $and: [
        options.where,
        { status: 'active' },
        {
          lastLoginAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      ],
    };

    // 4. Execute via repository
    return this.repository.find('user', options);
  }

  async getSalesSummary(query: any) {
    // Custom permission for sales data
    this.permissionService.assert('reports', ['read', 'view_sales']);

    const options = await this.queryEngine.parseAndCompile({
      collection: 'order',
      query: query,
    });

    // Business logic: only completed orders
    options.where = {
      $and: [options.where, { status: 'completed' }],
    };

    const orders = await this.repository.find('order', options);

    // Compute aggregates
    const total = orders.reduce((sum, order) => sum + order.amount, 0);

    return {
      orders,
      summary: {
        total,
        count: orders.length,
        average: total / orders.length,
      },
    };
  }
}
```

### 3. Register in Module

```typescript
// src/app.module.ts or custom module
@Module({
  imports: [QueryModule, RepositoryModule, CommonModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
```

## Reusing Query Parameters

Your custom API **automatically supports** Directus-style query parameters:

```http
GET /reports/active-users?filter={"role":"admin"}&sort=-lastLoginAt&limit=10
```

The `QueryEngineService` handles:

- Parsing `filter`, `sort`, `fields`, `deep`
- Applying permission filters
- Compiling to MikroORM queries

You just merge your custom logic into `options.where`.

## Permission Patterns

### Single Custom Action

```typescript
this.permissionService.assert('reports', 'generate');
```

### Multiple Required Actions

```typescript
this.permissionService.assert('analytics', ['read', 'export']);
```

### Virtual Scopes

Use logical scope names that don't map to entities:

```typescript
this.permissionService.assert('system', 'rebuild_index');
this.permissionService.assert('admin', 'manage_users');
```

## What You MUST Do

✅ **Inject** `QueryEngineService`, `GenericRepository`, `PermissionService`  
✅ **Call** `permissionService.assert()` with custom action  
✅ **Reuse** `queryEngine.parseAndCompile()` for user queries  
✅ **Execute** queries via `repository.find()` or `repository.count()`  
✅ **Add** custom business logic by merging filters

## What You MUST NOT Do

❌ **Never** inject `MikroORM` or `EntityManager` directly  
❌ **Never** bypass `PermissionService`  
❌ **Never** build queries manually with raw SQL  
❌ **Never** put business logic in controllers  
❌ **Never** access `repository` from controllers

## Advanced: Combining Multiple Collections

```typescript
async getDashboard(query: any) {
  this.permissionService.assert('dashboard', 'view');

  // Query multiple collections
  const userOptions = await this.queryEngine.parseAndCompile({
    collection: 'user',
    query: { filter: { status: 'active' } }
  });

  const postOptions = await this.queryEngine.parseAndCompile({
    collection: 'post',
    query: { filter: { status: 'published' } }
  });

  const [users, posts] = await Promise.all([
    this.repository.find('user', userOptions),
    this.repository.find('post', postOptions)
  ]);

  return {
    stats: {
      activeUsers: users.length,
      publishedPosts: posts.length
    },
    recentUsers: users.slice(0, 5),
    recentPosts: posts.slice(0, 5)
  };
}
```

## Testing Custom APIs

```bash
# Test permission
curl -X GET http://localhost:3000/reports/active-users
# Should return 403 if not authenticated

# Test with query params
curl -X GET "http://localhost:3000/reports/active-users?sort=-lastLoginAt&limit=5"

# Test with filters
curl -X GET "http://localhost:3000/reports/active-users?filter={\"role\":\"admin\"}"
```

## Summary

Custom APIs give you full control while maintaining:

- Consistent architecture
- Permission enforcement
- Query reusability
- Type safety

Follow the pattern: **Controller → Service → QueryEngine/Repository**, and you'll build maintainable, secure APIs.
````

## File: docs/extending-endpoints.md
````markdown
# Extending the Framework

## Adding New Entities

### 1. Create the Entity

```typescript
// src/database/entities/product.entity.ts
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class Product {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property()
  price!: number;

  @Property()
  stock!: number;
}
```

### 2. Register in MikroORM Config

```typescript
// src/database/mikro-orm.config.ts
import { Product } from './entities/product.entity';

export default defineConfig({
  entities: [User, Post, Comment, Product], // Add here
  // ... rest of config
});
```

### 3. That's It

The system automatically:

- Scans the entity on startup
- Maps `product` → `Product` entity
- Exposes `/items/product` endpoints

**No controller code needed.**

## Adding New RBAC Actions

### 1. Define Action Logic in PermissionService

```typescript
// src/common/permissions/permission.service.ts
can(collection: string, action: string): any {
  const user = this.context.user;

  if (user?.role === 'admin') return {};

  // Add your custom action
  if (action === 'approve') {
    return user && user.role === 'moderator' ? {} : false;
  }

  if (action === 'export_csv') {
    return user && ['admin', 'analyst'].includes(user.role) ? {} : false;
  }

  // ... existing logic
}
```

### 2. Use in Custom Endpoints

```typescript
// In your service
async approvePost(id: number) {
  this.permissionService.assert('post', 'approve');
  // ... approval logic
}

async exportData(collection: string, query: any) {
  this.permissionService.assert(collection, 'export_csv');
  // ... export logic
}
```

### 3. Apply to Multiple Endpoints

```typescript
// Reuse the same action across different services
class PostService {
  async approve(id: number) {
    this.permissionService.assert('post', 'approve');
  }
}

class CommentService {
  async approve(id: number) {
    this.permissionService.assert('comment', 'approve');
  }
}
```

## Extending Query Capabilities

### Adding a New Filter Operator

**1. Add to AST definition:**

```typescript
// src/query/ast/query.ast.ts
export type FilterOperator =
  | '_eq'
  | '_neq'
  | '_gt'
  | '_gte'
  | '_lt'
  | '_lte'
  | '_in'
  | '_nin'
  | '_contains'
  | '_starts_with'
  | '_regex' // NEW
  | '_between'; // NEW
```

**2. Add compilation logic:**

```typescript
// src/query/compiler/where.compiler.ts
private compileOperators(ops: any): any {
  const result: any = {};
  for (const op of Object.keys(ops)) {
    const val = ops[op];
    switch (op as FilterOperator) {
      case '_eq': result['$eq'] = val; break;
      // ... existing cases
      case '_regex':
        result['$re'] = val;
        break;
      case '_between':
        result['$gte'] = val[0];
        result['$lte'] = val[1];
        break;
      default: break;
    }
  }
  return result;
}
```

**3. Use it:**

```http
GET /items/post?filter={"title":{"_regex":"^Hello"}}
GET /items/product?filter={"price":{"_between":[10,100]}}
```

### Adding a New Query Parameter

**Example: Add `search` parameter for full-text search**

**1. Update QueryContext:**

```typescript
// src/query/ast/query.ast.ts
export interface ParsedQuery {
  filter: FilterNode;
  sort: SortNode[];
  pagination: PaginationNode;
  fields: string[];
  deep: DeepNode;
  search?: string; // NEW
}
```

**2. Create parser:**

```typescript
// src/query/parser/search.parser.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class SearchParser {
  parse(search: string): string | null {
    return search?.trim() || null;
  }
}
```

**3. Update QueryEngine:**

```typescript
// src/query/query-engine.service.ts
async parseAndCompile(context: QueryContext): Promise<any> {
  const parsed: ParsedQuery = {
    filter: this.filterParser.parse(query.filter) || {},
    sort: this.sortParser.parse(query.sort),
    pagination: this.paginationParser.parse(query),
    fields: this.fieldsParser.parse(query.fields),
    deep: this.deepParser.parse(query.deep),
    search: this.searchParser.parse(query.search), // NEW
  };

  // Apply search to filter
  if (parsed.search) {
    const searchFilter = {
      '$or': [
        { title: { '$like': `%${parsed.search}%` } },
        { content: { '$like': `%${parsed.search}%` } }
      ]
    };

    finalFilter = {
      '$and': [finalFilter, searchFilter]
    };
  }

  // ... rest of compilation
}
```

**4. Register parser:**

```typescript
// src/query/query.module.ts
@Module({
  providers: [
    // ... existing parsers
    SearchParser,
    QueryEngineService
  ],
})
```

**5. Use it:**

```http
GET /items/post?search=nestjs&sort=-createdAt
```

## Extension Boundaries

### ✅ Belongs in QueryEngine

- Parsing query parameters
- Compiling AST to ORM queries
- Applying permission filters
- Validating query structure

### ✅ Belongs in Service

- Business logic
- Custom permission checks
- Combining multiple queries
- Computing aggregates
- Calling external services

### ❌ NEVER in Controller

- Database queries
- Permission checks
- Business logic
- Data transformation
- ORM access

**Controllers are HTTP-only.** They:

- Extract parameters
- Call service methods
- Return responses
- Handle HTTP-specific concerns (headers, status codes)

## Pattern: Feature Flags

Add feature flags to control new functionality:

```typescript
// src/query/query-engine.service.ts
async parseAndCompile(context: QueryContext): Promise<any> {
  const { collection, query } = context;

  // Feature flag for experimental aggregation
  if (query.aggregate && this.isAggregationEnabled(collection)) {
    return this.compileAggregation(query);
  }

  // Standard query compilation
  // ...
}

private isAggregationEnabled(collection: string): boolean {
  // Check config or feature flag service
  return ['post', 'user'].includes(collection);
}
```

## Pattern: Collection-Specific Behavior

Override behavior for specific collections:

```typescript
// src/services/items.service.ts
async findMany(collection: string, query: any) {
  this.validateCollection(collection);

  const options = await this.queryEngine.parseAndCompile({
    collection,
    query,
  });

  // Collection-specific logic
  if (collection === 'post') {
    // Always exclude deleted posts
    options.where = {
      '$and': [options.where, { deletedAt: null }]
    };
  }

  return this.repository.find(collection, options);
}
```

## Pattern: Middleware for Query Transformation

Add hooks to transform queries before execution:

```typescript
// src/query/query-engine.service.ts
async parseAndCompile(context: QueryContext): Promise<any> {
  let parsed = this.parse(context.query);

  // Apply hooks
  parsed = await this.applyHooks('beforeCompile', context.collection, parsed);

  const compiled = this.compile(parsed);

  return compiled;
}

private async applyHooks(hook: string, collection: string, data: any) {
  // Call registered hooks
  // This allows plugins/extensions to modify queries
  return data;
}
```

## Summary

**Extension philosophy:**

1. **Entities** auto-register → zero config
2. **Actions** are strings → infinite extensibility
3. **Query params** are parsed → add new parsers
4. **Business logic** lives in services → never in controllers
5. **Framework code** stays generic → collection-specific logic in services

Follow these patterns and the system scales from 3 entities to 300.
````

## File: docs/meta-queries.md
````markdown
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
````

## File: docs/meta-query-examples.md
````markdown
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
````

## File: docs/query-dsl.md
````markdown
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
````

## File: docs/RBAC_ACTIONS.md
````markdown
# RBAC Action Model - Documentation

## Overview

The permission system supports **arbitrary action strings**, not just CRUD operations. This allows you to define custom permissions for any business operation.

## Core Concepts

### 1. Actions are Strings

Actions can be any string that represents a permission-controlled operation:

- Standard CRUD: `'read'`, `'create'`, `'update'`, `'delete'`
- Export/Import: `'export'`, `'import'`
- Publishing: `'publish'`, `'unpublish'`, `'approve'`
- System operations: `'rebuild_index'`, `'clear_cache'`
- Custom namespaced: `'custom:generate_report'`, `'admin:manage_users'`

### 2. Permission Methods

#### `assert(collection, action)`

Throws `ForbiddenException` if permission is denied. Use for boolean checks.

```typescript
// Single action
permissionService.assert('posts', 'publish');

// Multiple actions (ALL must pass)
permissionService.assert('reports', ['read', 'export']);
```

#### `can(collection, action)`

Returns filter constraints or boolean. Use for row-level security.

```typescript
const filter = permissionService.can('posts', 'read');
// Returns:
// - {} = allowed, no constraints
// - { status: 'published' } = allowed with filter
// - false = denied
```

## Usage Patterns

### Generic APIs (ItemsController)

HTTP methods automatically map to actions:

- `GET` → `'read'`
- `POST` → `'create'`
- `PATCH` → `'update'`
- `DELETE` → `'delete'`

```typescript
// In ItemsService
async create(collection: string, data: any) {
  this.permissionService.assert(collection, 'create');
  return this.repository.create(collection, data);
}
```

### Custom APIs

Explicitly declare required actions:

```typescript
// In ReportsService
async getActiveUsers(query: any) {
  // Custom action for report generation
  this.permissionService.assert('reports', 'generate');

  // ... business logic
}
```

### Virtual Scopes

Actions can apply to virtual collections (logical scopes):

```typescript
permissionService.assert('system', 'rebuild_index');
permissionService.assert('analytics', 'view_dashboard');
```

## Implementation in PermissionService

```typescript
can(collection: string, action: string): any {
  const user = this.context.user;

  // Admin bypass
  if (user?.role === 'admin') return {};

  // Custom action logic
  if (action === 'export') {
    return user ? {} : false;
  }

  if (action === 'publish') {
    return user && ['editor', 'admin'].includes(user.role) ? {} : false;
  }

  // Default logic
  return user ? {} : false;
}
```

## Examples

### Export Feature

```typescript
@Get(':collection/export')
async export(@Param('collection') collection: string) {
  this.permissionService.assert(collection, 'export');
  // ... export logic
}
```

### Multi-Action Check

```typescript
async publishPost(id: number) {
  // User must have both read AND publish permissions
  this.permissionService.assert('posts', ['read', 'publish']);
  // ... publish logic
}
```

### Custom Report with Virtual Scope

```typescript
@Get('reports/sales')
async salesReport() {
  this.permissionService.assert('reports', 'view_sales');
  // ... report logic
}
```

## Extension Points

To add new actions, simply:

1. Add logic in `PermissionService.can()` for the new action
2. Use `assert()` or `can()` in your service layer
3. No changes needed to controllers or infrastructure

The system is designed to be **action-agnostic** and **infinitely extensible**.
````

## File: docs/RBAC.md
````markdown
# RBAC Persistence Layer - Implementation Guide

## Overview

This document explains the RBAC (Role-Based Access Control) persistence layer implementation for the NestJS application. The system provides a flexible, database-backed permission system using MikroORM and PostgreSQL.

## Database Schema

### Tables

The RBAC system consists of 5 tables:

1. **`user`** - Extended with RBAC support
   - `id` (PK)
   - `name`
   - `email` (unique)
   - `password` (hashed, hidden from serialization)
   - `created_at`
   - `updated_at`

2. **`role`** - Role definitions
   - `id` (PK)
   - `name` (unique) - e.g., 'admin', 'editor', 'viewer'
   - `description` (nullable)

3. **`permission`** - Permission definitions
   - `id` (PK)
   - `collection` - Entity/resource scope (e.g., 'post', 'user', 'reports')
   - `action` - Operation allowed (e.g., 'read', 'create', 'export', 'publish')
   - `description` (nullable)
   - **Index**: Composite index on `(collection, action)` for efficient lookups

4. **`user_roles`** - Many-to-many join table
   - `user_id` (FK → users.id, PK)
   - `role_id` (FK → roles.id, PK)
   - Composite primary key on `(user_id, role_id)`

5. **`role_permissions`** - Many-to-many join table
   - `role_id` (FK → roles.id, PK)
   - `permission_id` (FK → permissions.id, PK)
   - Composite primary key on `(role_id, permission_id)`

### Entity Relationships

```
User ←→ Role ←→ Permission
 (M:N)     (M:N)
```

- A user can have multiple roles
- A role can be assigned to multiple users
- A role can have multiple permissions
- A permission can belong to multiple roles

## Design Decisions

### Why (collection, action) Model?

The permission system uses a `(collection, action)` pair instead of traditional resource-based permissions:

**Benefits:**

1. **Extensibility**: Actions are strings, not enums - add new actions without schema changes
2. **Flexibility**: Supports domain-specific actions beyond CRUD (e.g., 'publish', 'approve', 'export')
3. **Virtual Collections**: Collections aren't limited to database tables - can represent logical scopes (e.g., 'reports', 'analytics')
4. **Simplicity**: Easy to understand and query

**Examples:**

- `('post', 'read')` - Can read posts
- `('post', 'publish')` - Can publish posts (custom action)
- `('user', 'delete')` - Can delete users
- `('reports', 'export')` - Can export reports (virtual collection)

### Why Extensible Actions?

Actions are stored as strings rather than predefined enums to allow:

- Custom business logic actions (e.g., 'approve_invoice', 'generate_report')
- Workflow-specific operations (e.g., 'submit_for_review', 'archive')
- Future extensibility without database migrations

## Files Created

### Entities

- [`role.entity.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/database/entities/role.entity.ts) - Role entity with ManyToMany relations
- [`permission.entity.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/database/entities/permission.entity.ts) - Permission entity with (collection, action) model
- [`user.entity.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/database/entities/user.entity.ts) - Updated with password field and roles relation

### Migrations

- [`Migration20260116012800.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/database/migrations/Migration20260116012800.ts) - Creates all RBAC tables with indexes and constraints

### Services

- [`permission.service.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/common/permissions/permission.service.ts) - Updated to query RBAC database

## Usage

### PermissionService API

The `PermissionService` provides two main methods:

#### 1. `can(collection: string, action: string): Promise<any>`

Checks if the current user has permission to perform an action on a collection.

**Returns:**

- `{}` (empty object) = Permission granted, no row-level filters
- `{ filter }` = Permission granted with row-level constraints (future enhancement)
- `false` = Permission denied

**Example:**

```typescript
const result = await permissionService.can('post', 'publish');
if (result === false) {
  // User cannot publish posts
} else {
  // User can publish posts
}
```

#### 2. `assert(collection: string, action: string | string[]): Promise<void>`

Asserts that the user has permission. Throws `ForbiddenException` if denied.

**Example:**

```typescript
// Single action
await permissionService.assert('post', 'delete');

// Multiple actions (ALL must pass)
await permissionService.assert('post', ['read', 'update']);
```

#### 3. `hasRole(roleName: string): Promise<boolean>`

Helper method to check if user has a specific role.

**Example:**

```typescript
if (await permissionService.hasRole('admin')) {
  // User is an admin
}
```

### Permission Resolution Flow

When `can()` or `assert()` is called:

1. **Get current user** from `RequestContext`
2. **Load user's roles** from database (via `user_roles` join table)
3. **Load permissions** for those roles (via `role_permissions` join table)
4. **Check permission** - Does any role have a permission matching `(collection, action)`?
5. **Return result** - Grant or deny access

## Running Migrations

### Install Dependencies

```bash
npm install --save-dev @mikro-orm/cli @mikro-orm/migrations
```

### Run Migration

```bash
npm run migration:up
```

### Rollback Migration

```bash
npm run migration:down
```

## Future Enhancements

### Caching Layer (TODO)

The `PermissionService.can()` method includes extension points for caching:

```typescript
// TODO: Add caching layer here to avoid repeated database queries
// Extension point: Implement Redis/in-memory cache for user permissions
// Cache key: `user:${userId}:permissions` with TTL
```

**Recommended approach:**

- Cache user permissions in Redis with TTL (e.g., 5 minutes)
- Invalidate cache on role/permission changes
- Cache key format: `user:{userId}:permissions`

### Row-Level Security (TODO)

Future enhancement to return filter constraints:

```typescript
// Example: Limit to user's own records
return { authorId: user.id };
```

This would integrate with the QueryEngine to automatically filter results.

## NON-GOALS

The following features are **NOT** implemented (as per requirements):

- ❌ Field-level permissions
- ❌ Permission inheritance trees
- ❌ UI management logic
- ❌ Admin screens or seed scripts

## Testing

### Example: Creating Roles and Permissions

```typescript
// Create a role
const editorRole = em.create(Role, {
  name: 'editor',
  description: 'Can create and edit content',
});

// Create permissions
const readPostPermission = em.create(Permission, {
  collection: 'post',
  action: 'read',
  description: 'Can read posts',
});

const publishPostPermission = em.create(Permission, {
  collection: 'post',
  action: 'publish',
  description: 'Can publish posts',
});

// Assign permissions to role
editorRole.permissions.add(readPostPermission, publishPostPermission);

// Assign role to user
user.roles.add(editorRole);

await em.flush();
```

### Example: Checking Permissions

```typescript
// In a controller or service
const canPublish = await this.permissionService.can('post', 'publish');
if (canPublish) {
  // User can publish posts
}

// Or use assert to throw exception if denied
await this.permissionService.assert('post', 'publish');
```

## Summary

The RBAC persistence layer provides:

✅ Database-backed role and permission management  
✅ Flexible (collection, action) permission model  
✅ Extensible actions (not limited to CRUD)  
✅ Many-to-many relationships (users ↔ roles ↔ permissions)  
✅ Efficient database queries with composite indexes  
✅ Integration with existing PermissionService  
✅ Extension points for caching and row-level security  
✅ Comprehensive migrations for schema management

The system is ready for production use and can be extended with caching, row-level security, and custom permission logic as needed.
````

## File: eslint.config.mjs
````javascript
// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
````

## File: nest-cli.json
````json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
````

## File: src/app.controller.spec.ts
````typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
````

## File: src/app.controller.ts
````typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
````

## File: src/app.service.ts
````typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
````

## File: src/auth/auth.controller.ts
````typescript
import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * AuthController - Handles authentication endpoints.
 * 
 * Endpoints:
 * - POST /auth/login - Login with email/password
 * - POST /auth/refresh - Rotate refresh token
 * - POST /auth/logout - Revoke refresh token
 * - POST /auth/reset-password-request - Request password reset token
 * - POST /auth/reset-password - Reset password with token
 * - GET /auth/me - Get current user info (requires JWT)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const { accessToken, refreshToken } = await this.authService.login(
      dto.email,
      dto.password
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    const tokens = await this.authService.rotateRefreshToken(refreshToken);
    return tokens;
  }

  @Post('logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.authService.revokeRefreshToken(refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('reset-password-request')
  async requestPasswordReset(@Body('email') email: string) {
    // TODO: Find user by email and create reset token
    // For now, this is a placeholder
    return { message: 'Password reset email sent' };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: { id: number; email: string }) {
    return this.authService.getMe(user.id);
  }
}
````

## File: src/auth/auth.module.ts
````typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../database/entities/user.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { ResetPasswordToken } from '../database/entities/reset-password-token.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: {
        expiresIn: '15m', // Short-lived access token
      },
    }),
    MikroOrmModule.forFeature([User, RefreshToken, ResetPasswordToken]),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
````

## File: src/auth/decorators/current-user.decorator.ts
````typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
````

## File: src/auth/dto/login.dto.ts
````typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
````

## File: src/auth/dto/reset-password.dto.ts
````typescript
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
````

## File: src/auth/guards/jwt-auth.guard.ts
````typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
````

## File: src/auth/strategies/jwt.strategy.ts
````typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    });
  }

  async validate(payload: any) {
    return { id: payload.sub, email: payload.email };
  }
}
````

## File: src/common/common.module.ts
````typescript
import { Module, Global } from '@nestjs/common';
import { RequestContext } from './context/request.context';
import { PermissionService } from './permissions/permission.service';

@Global()
@Module({
  providers: [RequestContext, PermissionService],
  exports: [RequestContext, PermissionService],
})
export class CommonModule {}
````

## File: src/common/context/request.context.ts
````typescript
import { Injectable, Scope } from '@nestjs/common';

export interface UserContext {
  id: string | number;
  role: string;
  permissions?: any[];
}

@Injectable({ scope: Scope.REQUEST })
export class RequestContext {
  private _user: UserContext | null = null;
  private _tenantId: string | null = null;

  get user(): UserContext | null {
    return this._user;
  }

  set user(user: UserContext | null) {
    this._user = user;
  }

  get tenantId(): string | null {
    return this._tenantId;
  }

  set tenantId(id: string | null) {
    this._tenantId = id;
  }
}
````

## File: src/common/exceptions/invalid-query.exception.ts
````typescript
import { BadRequestException } from '@nestjs/common';

export class InvalidQueryException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
````

## File: src/config/auth.config.ts
````typescript
import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '7d',
  maxFailedRefreshInfo: parseInt(process.env.AUTH_MAX_FAILED_REFRESH || '5', 10),
  logLevel: process.env.AUTH_LOG_LEVEL || 'basic',
}));
````

## File: src/config/database.config.ts
````typescript
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  name: process.env.DB_NAME || 'postgres',
  allowGlobalContext: process.env.DB_ALLOW_GLOBAL_CONTEXT === 'true' || process.env.NODE_ENV !== 'production',
}));
````

## File: src/config/query.config.ts
````typescript
import { registerAs } from '@nestjs/config';

export default registerAs('query', () => ({
  maxDepth: parseInt(process.env.QUERY_MAX_DEPTH || '3', 10),
  maxConditions: parseInt(process.env.QUERY_MAX_CONDITIONS || '20', 10),
  maxSortFields: parseInt(process.env.QUERY_MAX_SORT_FIELDS || '3', 10),
  allowRegex: process.env.QUERY_ALLOW_REGEX === 'true',
}));
````

## File: src/config/storage.config.ts
````typescript
import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  driver: process.env.STORAGE_DRIVER || 'local',
  path: process.env.FILE_STORAGE_PATH || './storage',
}));
````

## File: src/controllers/items.controller.ts
````typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ItemsService } from '../services/items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get(':collection')
  async findMany(@Param('collection') collection: string, @Query() query: any) {
    return this.itemsService.findMany(collection, query);
  }

  @Get(':collection/:id')
  async findOne(
      @Param('collection') collection: string, 
      @Param('id') id: string,
      @Query() query: any
  ) {
    // Attempt parse ID as number if possible, or keep string
    const parsedId = !isNaN(Number(id)) ? Number(id) : id;
    return this.itemsService.findOne(collection, parsedId, query);
  }

  @Post(':collection')
  async create(@Param('collection') collection: string, @Body() body: any) {
    return this.itemsService.create(collection, body);
  }

  @Patch(':collection/:id')
  async update(
      @Param('collection') collection: string, 
      @Param('id') id: string, 
      @Body() body: any
  ) {
    const parsedId = !isNaN(Number(id)) ? Number(id) : id;
    return this.itemsService.update(collection, parsedId, body);
  }

  @Delete(':collection/:id')
  async delete(
      @Param('collection') collection: string, 
      @Param('id') id: string
  ) {
    const parsedId = !isNaN(Number(id)) ? Number(id) : id;
    return this.itemsService.delete(collection, parsedId);
  }
}
````

## File: src/controllers/reports.controller.ts
````typescript
import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from '../services/reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('active-users')
  async getActiveUsers(@Query() query: any) {
    // Allows standard Directus filtering on top of custom logic
    return this.reportsService.getActiveUsers(query);
  }
}
````

## File: src/database/entities/file.entity.ts
````typescript
import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  Index,
} from '@mikro-orm/core';

/**
 * File status enum for tracking lifecycle
 * TEMP - Temporary upload, not yet committed
 * ACTIVE - Committed and available
 * DELETED - Soft-deleted (for cleanup)
 */
export enum FileStatus {
  TEMP = 'TEMP',
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
}

/**
 * File entity for managing uploaded files
 * Uses ULID as primary key for globally unique, sortable IDs
 */
@Entity({ tableName: 'files'})
export class File {
  /**
   * Primary key using PostgreSQL UUID
   * Auto-generated by database using gen_random_uuid()
   */
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  /**
   * Original filename from user upload
   */
  @Property()
  originalName!: string;

  /**
   * Stored filename on filesystem (typically same as ID)
   */
  @Property()
  storedName!: string;

  /**
   * MIME type of the file (e.g., 'image/jpeg', 'application/pdf')
   */
  @Property()
  mimeType!: string;

  /**
   * File size in bytes
   * Using bigint to support large files (though enforced max is 100MB)
   */
  @Property({ type: 'bigint' })
  size!: bigint;

  /**
   * Relative storage path from storage root
   * e.g., 'temp/{id}' or 'uploads/{id}'
   */
  @Property()
  storagePath!: string;

  /**
   * File lifecycle status
   * Indexed for efficient cleanup queries
   */
  @Enum(() => FileStatus)
  @Index()
  status: FileStatus = FileStatus.TEMP;

  /**
   * Optional custom metadata as JSON
   * Can store user-provided tags, descriptions, etc.
   */
  @Property({ type: 'jsonb', nullable: true })
  customMetadata?: Record<string, any>;

  /**
   * Timestamp when file was created
   */
  @Property()
  createdAt: Date = new Date();

  /**
   * Timestamp when file was last updated
   */
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
````

## File: src/database/migrations/.snapshot-postgres.json
````json
{
  "namespaces": [
    "public"
  ],
  "name": "public",
  "tables": [
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "uuid",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "uuid"
        },
        "original_name": {
          "name": "original_name",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "stored_name": {
          "name": "stored_name",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "mime_type": {
          "name": "mime_type",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "size": {
          "name": "size",
          "type": "bigint",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "bigint"
        },
        "storage_path": {
          "name": "storage_path",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "status": {
          "name": "status",
          "type": "text",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "default": "'TEMP'",
          "enumItems": [
            "TEMP",
            "ACTIVE",
            "DELETED"
          ],
          "mappedType": "enum"
        },
        "custom_metadata": {
          "name": "custom_metadata",
          "type": "jsonb",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": true,
          "mappedType": "json"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        }
      },
      "name": "files",
      "schema": "public",
      "indexes": [
        {
          "columnNames": [
            "status"
          ],
          "composite": false,
          "keyName": "files_status_index",
          "constraint": false,
          "primary": false,
          "unique": false
        },
        {
          "keyName": "files_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {},
      "nativeEnums": {}
    },
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "serial",
          "unsigned": false,
          "autoincrement": true,
          "primary": true,
          "nullable": false,
          "mappedType": "integer"
        },
        "collection": {
          "name": "collection",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "action": {
          "name": "action",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "description": {
          "name": "description",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": true,
          "length": 255,
          "mappedType": "string"
        }
      },
      "name": "permissions",
      "schema": "public",
      "indexes": [
        {
          "keyName": "permissions_collection_action_index",
          "columnNames": [
            "collection",
            "action"
          ],
          "composite": true,
          "constraint": false,
          "primary": false,
          "unique": false
        },
        {
          "keyName": "permissions_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {},
      "nativeEnums": {}
    },
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "serial",
          "unsigned": false,
          "autoincrement": true,
          "primary": true,
          "nullable": false,
          "mappedType": "integer"
        },
        "name": {
          "name": "name",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "description": {
          "name": "description",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": true,
          "length": 255,
          "mappedType": "string"
        }
      },
      "name": "roles",
      "schema": "public",
      "indexes": [
        {
          "columnNames": [
            "name"
          ],
          "composite": false,
          "keyName": "roles_name_unique",
          "constraint": true,
          "primary": false,
          "unique": true
        },
        {
          "keyName": "roles_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {},
      "nativeEnums": {}
    },
    {
      "columns": {
        "role_id": {
          "name": "role_id",
          "type": "int",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "integer"
        },
        "permission_id": {
          "name": "permission_id",
          "type": "int",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "integer"
        }
      },
      "name": "roles_permissions",
      "schema": "public",
      "indexes": [
        {
          "keyName": "roles_permissions_pkey",
          "columnNames": [
            "role_id",
            "permission_id"
          ],
          "composite": true,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {
        "roles_permissions_role_id_foreign": {
          "constraintName": "roles_permissions_role_id_foreign",
          "columnNames": [
            "role_id"
          ],
          "localTableName": "public.roles_permissions",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.roles",
          "deleteRule": "cascade",
          "updateRule": "cascade"
        },
        "roles_permissions_permission_id_foreign": {
          "constraintName": "roles_permissions_permission_id_foreign",
          "columnNames": [
            "permission_id"
          ],
          "localTableName": "public.roles_permissions",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.permissions",
          "deleteRule": "cascade",
          "updateRule": "cascade"
        }
      },
      "nativeEnums": {}
    },
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "serial",
          "unsigned": false,
          "autoincrement": true,
          "primary": true,
          "nullable": false,
          "mappedType": "integer"
        },
        "name": {
          "name": "name",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "email": {
          "name": "email",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "password": {
          "name": "password",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        }
      },
      "name": "users",
      "schema": "public",
      "indexes": [
        {
          "columnNames": [
            "email"
          ],
          "composite": false,
          "keyName": "users_email_unique",
          "constraint": true,
          "primary": false,
          "unique": true
        },
        {
          "keyName": "users_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {},
      "nativeEnums": {}
    },
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "serial",
          "unsigned": false,
          "autoincrement": true,
          "primary": true,
          "nullable": false,
          "mappedType": "integer"
        },
        "token_id": {
          "name": "token_id",
          "type": "varchar(26)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 26,
          "mappedType": "string"
        },
        "secret_hash": {
          "name": "secret_hash",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "user_id": {
          "name": "user_id",
          "type": "int",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "integer"
        },
        "expires_at": {
          "name": "expires_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        },
        "used_at": {
          "name": "used_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": true,
          "length": 6,
          "mappedType": "datetime"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        }
      },
      "name": "reset_password_tokens",
      "schema": "public",
      "indexes": [
        {
          "columnNames": [
            "token_id"
          ],
          "composite": false,
          "keyName": "reset_password_tokens_token_id_index",
          "constraint": false,
          "primary": false,
          "unique": false
        },
        {
          "columnNames": [
            "token_id"
          ],
          "composite": false,
          "keyName": "reset_password_tokens_token_id_unique",
          "constraint": true,
          "primary": false,
          "unique": true
        },
        {
          "keyName": "reset_password_tokens_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {
        "reset_password_tokens_user_id_foreign": {
          "constraintName": "reset_password_tokens_user_id_foreign",
          "columnNames": [
            "user_id"
          ],
          "localTableName": "public.reset_password_tokens",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.users",
          "updateRule": "cascade"
        }
      },
      "nativeEnums": {}
    },
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "serial",
          "unsigned": false,
          "autoincrement": true,
          "primary": true,
          "nullable": false,
          "mappedType": "integer"
        },
        "token_id": {
          "name": "token_id",
          "type": "varchar(26)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 26,
          "mappedType": "string"
        },
        "secret_hash": {
          "name": "secret_hash",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "user_id": {
          "name": "user_id",
          "type": "int",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "integer"
        },
        "expires_at": {
          "name": "expires_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        },
        "revoked_at": {
          "name": "revoked_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": true,
          "length": 6,
          "mappedType": "datetime"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        }
      },
      "name": "refresh_tokens",
      "schema": "public",
      "indexes": [
        {
          "columnNames": [
            "token_id"
          ],
          "composite": false,
          "keyName": "refresh_tokens_token_id_index",
          "constraint": false,
          "primary": false,
          "unique": false
        },
        {
          "columnNames": [
            "token_id"
          ],
          "composite": false,
          "keyName": "refresh_tokens_token_id_unique",
          "constraint": true,
          "primary": false,
          "unique": true
        },
        {
          "keyName": "refresh_tokens_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {
        "refresh_tokens_user_id_foreign": {
          "constraintName": "refresh_tokens_user_id_foreign",
          "columnNames": [
            "user_id"
          ],
          "localTableName": "public.refresh_tokens",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.users",
          "updateRule": "cascade"
        }
      },
      "nativeEnums": {}
    },
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "serial",
          "unsigned": false,
          "autoincrement": true,
          "primary": true,
          "nullable": false,
          "mappedType": "integer"
        },
        "title": {
          "name": "title",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "content": {
          "name": "content",
          "type": "text",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "text"
        },
        "status": {
          "name": "status",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "default": "'draft'",
          "mappedType": "string"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        },
        "author_id": {
          "name": "author_id",
          "type": "int",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "integer"
        }
      },
      "name": "posts",
      "schema": "public",
      "indexes": [
        {
          "keyName": "posts_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {
        "posts_author_id_foreign": {
          "constraintName": "posts_author_id_foreign",
          "columnNames": [
            "author_id"
          ],
          "localTableName": "public.posts",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.users",
          "updateRule": "cascade"
        }
      },
      "nativeEnums": {}
    },
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "serial",
          "unsigned": false,
          "autoincrement": true,
          "primary": true,
          "nullable": false,
          "mappedType": "integer"
        },
        "body": {
          "name": "body",
          "type": "text",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "text"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        },
        "author_id": {
          "name": "author_id",
          "type": "int",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "integer"
        },
        "post_id": {
          "name": "post_id",
          "type": "int",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "integer"
        }
      },
      "name": "comments",
      "schema": "public",
      "indexes": [
        {
          "keyName": "comments_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {
        "comments_author_id_foreign": {
          "constraintName": "comments_author_id_foreign",
          "columnNames": [
            "author_id"
          ],
          "localTableName": "public.comments",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.users",
          "updateRule": "cascade"
        },
        "comments_post_id_foreign": {
          "constraintName": "comments_post_id_foreign",
          "columnNames": [
            "post_id"
          ],
          "localTableName": "public.comments",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.posts",
          "updateRule": "cascade"
        }
      },
      "nativeEnums": {}
    },
    {
      "columns": {
        "user_id": {
          "name": "user_id",
          "type": "int",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "integer"
        },
        "role_id": {
          "name": "role_id",
          "type": "int",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "integer"
        }
      },
      "name": "users_roles",
      "schema": "public",
      "indexes": [
        {
          "keyName": "users_roles_pkey",
          "columnNames": [
            "user_id",
            "role_id"
          ],
          "composite": true,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {
        "users_roles_user_id_foreign": {
          "constraintName": "users_roles_user_id_foreign",
          "columnNames": [
            "user_id"
          ],
          "localTableName": "public.users_roles",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.users",
          "deleteRule": "cascade",
          "updateRule": "cascade"
        },
        "users_roles_role_id_foreign": {
          "constraintName": "users_roles_role_id_foreign",
          "columnNames": [
            "role_id"
          ],
          "localTableName": "public.users_roles",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.roles",
          "deleteRule": "cascade",
          "updateRule": "cascade"
        }
      },
      "nativeEnums": {}
    }
  ],
  "nativeEnums": {}
}
````

## File: src/database/migrations/Migration20260116000000_InitialSchema.ts
````typescript
import { Migration } from '@mikro-orm/migrations';

/**
 * Initial database schema migration.
 * Creates base tables: users, posts, comments
 */
export class Migration20260116000000_InitialSchema extends Migration {

  async up(): Promise<void> {
    // Create users table
    this.addSql(`
      create table if not exists "users" (
        "id" serial primary key,
        "name" varchar(255) not null,
        "email" varchar(255) not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "users_email_unique" unique ("email")
      );
    `);

    // Create posts table
    this.addSql(`
      create table if not exists "posts" (
        "id" serial primary key,
        "title" varchar(255) not null,
        "content" text not null,
        "author_id" int not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "posts_author_id_foreign" 
        foreign key ("author_id") references "users" ("id") 
        on update cascade on delete cascade
      );
    `);

    // Create comments table
    this.addSql(`
      create table if not exists "comments" (
        "id" serial primary key,
        "content" text not null,
        "author_id" int not null,
        "post_id" int not null,
        "created_at" timestamptz not null default now(),
        constraint "comments_author_id_foreign" 
        foreign key ("author_id") references "users" ("id") 
        on update cascade on delete cascade,
        constraint "comments_post_id_foreign" 
        foreign key ("post_id") references "posts" ("id") 
        on update cascade on delete cascade
      );
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "comments" cascade;`);
    this.addSql(`drop table if exists "posts" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
  }
}
````

## File: src/database/migrations/Migration20260116012800.ts
````typescript
import { Migration } from '@mikro-orm/migrations';

/**
 * RBAC (Role-Based Access Control) migration.
 * 
 * Creates the following tables:
 * 1. roles - Role definitions
 * 2. permissions - Permission definitions with (collection, action) model
 * 3. users_roles - Many-to-many join table for user-role assignments
 * 4. roles_permissions - Many-to-many join table for role-permission grants
 * 
 * Note: This assumes base tables (users, posts, comments) already exist.
 * If they don't, run the base migration first.
 */
export class Migration20260116012800 extends Migration {

  async up(): Promise<void> {
    // Create roles table
    this.addSql(`
      create table "roles" (
        "id" serial primary key,
        "name" varchar(255) not null,
        "description" varchar(255) null,
        constraint "roles_name_unique" unique ("name")
      );
    `);

    // Create permissions table with composite index on (collection, action)
    this.addSql(`
      create table "permissions" (
        "id" serial primary key,
        "collection" varchar(255) not null,
        "action" varchar(255) not null,
        "description" varchar(255) null
      );
    `);

    // Create composite index for efficient permission lookups
    this.addSql(`
      create index "permissions_collection_action_index" 
      on "permissions" ("collection", "action");
    `);

    // Add password field to existing users table (if it exists)
    this.addSql(`
      alter table "users" 
      add column if not exists "password" varchar(255);
    `);

    // Create users_roles join table (many-to-many)
    this.addSql(`
      create table "users_roles" (
        "user_id" int not null,
        "role_id" int not null,
        constraint "users_roles_pkey" primary key ("user_id", "role_id")
      );
    `);

    // Add foreign key constraints for users_roles
    this.addSql(`
      alter table "users_roles" 
      add constraint "users_roles_user_id_foreign" 
      foreign key ("user_id") references "users" ("id") 
      on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "users_roles" 
      add constraint "users_roles_role_id_foreign" 
      foreign key ("role_id") references "roles" ("id") 
      on update cascade on delete cascade;
    `);

    // Create roles_permissions join table (many-to-many)
    this.addSql(`
      create table "roles_permissions" (
        "role_id" int not null,
        "permission_id" int not null,
        constraint "roles_permissions_pkey" primary key ("role_id", "permission_id")
      );
    `);

    // Add foreign key constraints for roles_permissions
    this.addSql(`
      alter table "roles_permissions" 
      add constraint "roles_permissions_role_id_foreign" 
      foreign key ("role_id") references "roles" ("id") 
      on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "roles_permissions" 
      add constraint "roles_permissions_permission_id_foreign" 
      foreign key ("permission_id") references "permissions" ("id") 
      on update cascade on delete cascade;
    `);
  }

  async down(): Promise<void> {
    // Drop join tables first (due to foreign key constraints)
    this.addSql(`drop table if exists "roles_permissions" cascade;`);
    this.addSql(`drop table if exists "users_roles" cascade;`);

    // Remove password column from users (if it exists)
    this.addSql(`alter table "users" drop column if exists "password";`);

    // Drop RBAC tables
    this.addSql(`drop table if exists "permissions" cascade;`);
    this.addSql(`drop table if exists "roles" cascade;`);
  }
}
````

## File: src/database/migrations/Migration20260116094900_TokenTables.ts
````typescript
import { Migration } from '@mikro-orm/migrations';

/**
 * Migration for Refresh Token and Reset Password Token tables.
 * 
 * Implements split-token model:
 * - token_id: ULID stored in plaintext, indexed for O(1) lookup
 * - secret_hash: argon2 hash of token secret
 * 
 * Security guarantee: All token verification uses indexed lookup by token_id.
 * No table scans, no hash queries.
 */
export class Migration20260116094900_TokenTables extends Migration {

  async up(): Promise<void> {
    // Create refresh_tokens table
    this.addSql(`
      create table "refresh_tokens" (
        "id" serial primary key,
        "token_id" varchar(26) not null,
        "secret_hash" varchar(255) not null,
        "user_id" int not null,
        "expires_at" timestamptz not null,
        "revoked_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "refresh_tokens_token_id_unique" unique ("token_id")
      );
    `);

    // Create index on token_id for O(1) lookup
    this.addSql(`
      create index "refresh_tokens_token_id_index" 
      on "refresh_tokens" ("token_id");
    `);

    // Create index on user_id for user-specific queries
    this.addSql(`
      create index "refresh_tokens_user_id_index" 
      on "refresh_tokens" ("user_id");
    `);

    // Add foreign key constraint
    this.addSql(`
      alter table "refresh_tokens" 
      add constraint "refresh_tokens_user_id_foreign" 
      foreign key ("user_id") references "users" ("id") 
      on update cascade on delete cascade;
    `);

    // Create reset_password_tokens table
    this.addSql(`
      create table "reset_password_tokens" (
        "id" serial primary key,
        "token_id" varchar(26) not null,
        "secret_hash" varchar(255) not null,
        "user_id" int not null,
        "expires_at" timestamptz not null,
        "used_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "reset_password_tokens_token_id_unique" unique ("token_id")
      );
    `);

    // Create index on token_id for O(1) lookup
    this.addSql(`
      create index "reset_password_tokens_token_id_index" 
      on "reset_password_tokens" ("token_id");
    `);

    // Create index on user_id
    this.addSql(`
      create index "reset_password_tokens_user_id_index" 
      on "reset_password_tokens" ("user_id");
    `);

    // Add foreign key constraint
    this.addSql(`
      alter table "reset_password_tokens" 
      add constraint "reset_password_tokens_user_id_foreign" 
      foreign key ("user_id") references "users" ("id") 
      on update cascade on delete cascade;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "reset_password_tokens" cascade;`);
    this.addSql(`drop table if exists "refresh_tokens" cascade;`);
  }
}
````

## File: src/database/migrations/Migration20260124030806.ts
````typescript
import { Migration } from '@mikro-orm/migrations';

export class Migration20260124030806 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "files" ("id" uuid not null default gen_random_uuid(), "original_name" varchar(255) not null, "stored_name" varchar(255) not null, "mime_type" varchar(255) not null, "size" bigint not null, "storage_path" varchar(255) not null, "status" text check ("status" in ('TEMP', 'ACTIVE', 'DELETED')) not null default 'TEMP', "custom_metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "files_pkey" primary key ("id"));`);
    this.addSql(`create index "files_status_index" on "files" ("status");`);

    this.addSql(`alter table "reset_password_tokens" drop constraint "reset_password_tokens_user_id_foreign";`);

    this.addSql(`alter table "refresh_tokens" drop constraint "refresh_tokens_user_id_foreign";`);

    this.addSql(`alter table "posts" drop constraint "posts_author_id_foreign";`);

    this.addSql(`alter table "comments" drop constraint "comments_author_id_foreign";`);
    this.addSql(`alter table "comments" drop constraint "comments_post_id_foreign";`);

    this.addSql(`alter table "users" alter column "created_at" drop default;`);
    this.addSql(`alter table "users" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "users" alter column "updated_at" drop default;`);
    this.addSql(`alter table "users" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);
    this.addSql(`alter table "users" alter column "password" type varchar(255) using ("password"::varchar(255));`);
    this.addSql(`alter table "users" alter column "password" set not null;`);

    this.addSql(`drop index "reset_password_tokens_user_id_index";`);

    this.addSql(`alter table "reset_password_tokens" alter column "created_at" drop default;`);
    this.addSql(`alter table "reset_password_tokens" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "reset_password_tokens" add constraint "reset_password_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`drop index "refresh_tokens_user_id_index";`);

    this.addSql(`alter table "refresh_tokens" alter column "created_at" drop default;`);
    this.addSql(`alter table "refresh_tokens" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "refresh_tokens" add constraint "refresh_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "posts" alter column "created_at" drop default;`);
    this.addSql(`alter table "posts" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "posts" alter column "updated_at" drop default;`);
    this.addSql(`alter table "posts" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);
    this.addSql(`alter table "posts" alter column "status" type varchar(255) using ("status"::varchar(255));`);
    this.addSql(`alter table "posts" alter column "status" set not null;`);
    this.addSql(`alter table "posts" add constraint "posts_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "comments" alter column "created_at" drop default;`);
    this.addSql(`alter table "comments" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "comments" rename column "content" to "body";`);
    this.addSql(`alter table "comments" add constraint "comments_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "comments" add constraint "comments_post_id_foreign" foreign key ("post_id") references "posts" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "files" cascade;`);

    this.addSql(`alter table "comments" drop constraint "comments_author_id_foreign";`);
    this.addSql(`alter table "comments" drop constraint "comments_post_id_foreign";`);

    this.addSql(`alter table "posts" drop constraint "posts_author_id_foreign";`);

    this.addSql(`alter table "refresh_tokens" drop constraint "refresh_tokens_user_id_foreign";`);

    this.addSql(`alter table "reset_password_tokens" drop constraint "reset_password_tokens_user_id_foreign";`);

    this.addSql(`alter table "comments" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "comments" alter column "created_at" set default now();`);
    this.addSql(`alter table "comments" rename column "body" to "content";`);
    this.addSql(`alter table "comments" add constraint "comments_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "comments" add constraint "comments_post_id_foreign" foreign key ("post_id") references "posts" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "posts" alter column "status" type varchar(50) using ("status"::varchar(50));`);
    this.addSql(`alter table "posts" alter column "status" drop not null;`);
    this.addSql(`alter table "posts" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "posts" alter column "created_at" set default now();`);
    this.addSql(`alter table "posts" alter column "updated_at" type timestamptz(6) using ("updated_at"::timestamptz(6));`);
    this.addSql(`alter table "posts" alter column "updated_at" set default now();`);
    this.addSql(`alter table "posts" add constraint "posts_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "refresh_tokens" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "refresh_tokens" alter column "created_at" set default now();`);
    this.addSql(`alter table "refresh_tokens" add constraint "refresh_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`create index "refresh_tokens_user_id_index" on "refresh_tokens" ("user_id");`);

    this.addSql(`alter table "reset_password_tokens" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "reset_password_tokens" alter column "created_at" set default now();`);
    this.addSql(`alter table "reset_password_tokens" add constraint "reset_password_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`create index "reset_password_tokens_user_id_index" on "reset_password_tokens" ("user_id");`);

    this.addSql(`alter table "users" alter column "password" type varchar(255) using ("password"::varchar(255));`);
    this.addSql(`alter table "users" alter column "password" drop not null;`);
    this.addSql(`alter table "users" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "users" alter column "created_at" set default now();`);
    this.addSql(`alter table "users" alter column "updated_at" type timestamptz(6) using ("updated_at"::timestamptz(6));`);
    this.addSql(`alter table "users" alter column "updated_at" set default now();`);
  }

}
````

## File: src/files/dto/commit-file.dto.ts
````typescript
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CommitFileDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  originalName?: string;

  @IsOptional()
  @IsObject()
  extraMetadata?: Record<string, any>;
}
````

## File: src/files/dto/temp-upload-response.dto.ts
````typescript
export class TempUploadResponseDto {
  id!: string;
  originalName!: string;
  mimeType!: string;
  size!: number;
  previewUrl!: string;

  constructor(partial: Partial<TempUploadResponseDto>) {
    Object.assign(this, partial);
  }
}
````

## File: src/files/files.controller.ts
````typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  Res,
  Query,
  BadRequestException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { CommitFileDto } from './dto/commit-file.dto';
import { TempUploadResponseDto } from './dto/temp-upload-response.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * POST /files/upload
   * Upload file to temporary storage
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTemp(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<TempUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.filesService.uploadTemp(file);
  }

  /**
   * GET /files/temp/:id/preview
   * Stream temporary file for preview
   */
  @Get('temp/:id/preview')
  async previewTemp(@Param('id') id: string, @Res() res: Response) {
    const fileMetadata = await this.filesService.getMetadata(id);
    const stream = await this.filesService.getTempFileStream(id);

    // Set headers for inline preview with full info for Postman
    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileMetadata.originalName}"`,
    );
    res.setHeader('Content-Length', fileMetadata.size.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for temp preview
    res.setHeader('Accept-Ranges', 'bytes');

    stream.pipe(res);
  }

  /**
   * POST /files/commit
   * Commit file from temp to permanent storage
   */
  @Post('commit')
  async commitFile(@Body() dto: CommitFileDto) {
    return this.filesService.commitFile(dto.id, dto.extraMetadata, dto.originalName);
  }

  /**
   * GET /files/:id
   * Get file metadata only (no streaming)
   */
  @Get(':id')
  async getFileMetadata(@Param('id') id: string) {
    const file = await this.filesService.getMetadata(id);

    // Convert bigint to string for JSON serialization
    return {
      ...file,
      size: file.size.toString(),
    };
  }
}

@Controller('assets')
export class AssetsController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * GET /assets/:id
   * Stream permanent file with Range support
   */
  @Get(':id')
  async streamAsset(
    @Param('id') id: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.filesService.getFileStream(id);

    // Set Content-Disposition based on download parameter
    const disposition = download === 'true' ? 'attachment' : 'inline';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${file.originalName}"`,
    );

    // Set Content-Type
    res.setHeader('Content-Type', file.mimeType);

    // Set Content-Length
    res.setHeader('Content-Length', file.size.toString());

    // Set Cache-Control as requested
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    // Enable Range requests
    res.setHeader('Accept-Ranges', 'bytes');

    // For now, stream entire file (Range handling can be added here)
    stream.pipe(res);
  }
}
````

## File: src/files/files.module.ts
````typescript
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ScheduleModule } from '@nestjs/schedule';
import { File } from '../database/entities/file.entity';
import { FilesController, AssetsController } from './files.controller';
import { FilesService } from './files.service';
import { FilesScheduler } from './files.scheduler';
import { StorageService } from '../storage/storage.service';
import { LocalStorageAdapter } from '../storage/local-storage.adapter';

@Module({
  imports: [MikroOrmModule.forFeature([File]), ScheduleModule.forRoot()],
  controllers: [FilesController, AssetsController],
  providers: [FilesService, FilesScheduler, StorageService, LocalStorageAdapter],
  exports: [FilesService],
})
export class FilesModule {}
````

## File: src/files/files.scheduler.ts
````typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilesService } from './files.service';

/**
 * Scheduled task for cleanup of old temporary files
 * Runs every 5 days
 */
@Injectable()
export class FilesScheduler {
  private readonly logger = new Logger(FilesScheduler.name);

  constructor(private readonly filesService: FilesService) {}

  /**
   * Delete temp files older than 5 days
   * Runs every 5 days at midnight
   */
  @Cron('0 0 */5 * *', {
    name: 'cleanup-temp-files',
    timeZone: 'UTC',
  })
  async handleTempFileCleanup() {
    this.logger.log('Starting temp file cleanup task');

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    try {
      const deletedCount =
        await this.filesService.cleanupTempFiles(fiveDaysAgo);
      this.logger.log(`Deleted ${deletedCount} old temp files`);
    } catch (error) {
      this.logger.error('Error during temp file cleanup:', error);
    }
  }
}
````

## File: src/files/files.service.ts
````typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { File, FileStatus } from '../database/entities/file.entity';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { TempUploadResponseDto } from './dto/temp-upload-response.dto';
import { ReadStream } from 'fs';

@Injectable()
export class FilesService {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: EntityRepository<File>,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    // Default 100MB = 104857600 bytes
    this.maxFileSize =
      this.configService.get<number>('FILE_MAX_SIZE') || 104857600;

    const allowedTypes = this.configService.get<string>('FILE_ALLOWED_TYPES');
    this.allowedMimeTypes = allowedTypes
      ? allowedTypes.split(',')
      : [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'text/plain',
        ];
  }

  /**
   * Upload file to temporary storage
   * Creates temp database record for tracking
   */
  async uploadTemp(file: Express.Multer.File): Promise<TempUploadResponseDto> {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    // Validate MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    // Create temp database record (id will be auto-generated by database)
    const tempFile = this.fileRepository.create({
      originalName: file.originalname,
      storedName: '', // Will be updated after we get the id
      mimeType: file.mimetype,
      size: BigInt(file.size),
      storagePath: '', // Will be updated after we get the id
      status: FileStatus.TEMP,
      customMetadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.fileRepository.getEntityManager().persistAndFlush(tempFile);

    // Now we have the auto-generated id, save file to storage
    const storageResult = await this.storageService.saveTemp(file, tempFile.id);

    // Update the record with storage info
    tempFile.storedName = storageResult.storedName;
    tempFile.storagePath = storageResult.storagePath;
    await this.fileRepository.getEntityManager().flush();

    return new TempUploadResponseDto({
      id: tempFile.id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      previewUrl: `/files/temp/${tempFile.id}/preview`,
    });
  }

  /**
   * Commit file from temp to permanent storage
   * Updates database record status
   */
  async commitFile(
    id: string,
    extraMetadata?: Record<string, any>,
    originalName?: string,
  ): Promise<File> {
    // Find existing temp file
    const tempFile = await this.fileRepository.findOne({ 
      id,
      status: FileStatus.TEMP 
    });
    
    if (!tempFile) {
      throw new NotFoundException('Temporary file not found or already committed');
    }

    const tempPath = `temp/${id}`;
    const permanentPath = `uploads/${id}`;

    // Verify temp file exists in storage
    const exists = await this.storageService.exists(tempPath);
    if (!exists) {
      throw new NotFoundException('Temporary file not found in storage');
    }

    // Move to permanent storage
    await this.storageService.moveToPermanent(tempPath, permanentPath);

    // Update record to active status
    tempFile.storagePath = permanentPath;
    tempFile.status = FileStatus.ACTIVE;
    if (originalName) {
      tempFile.originalName = originalName;
    }
    tempFile.customMetadata = extraMetadata || tempFile.customMetadata;
    tempFile.updatedAt = new Date();

    await this.fileRepository.getEntityManager().persistAndFlush(tempFile);

    return tempFile;
  }

  /**
   * Get file metadata from database
   */
  async getMetadata(id: string): Promise<File> {
    const file = await this.fileRepository.findOne({ id });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  /**
   * Get file stream for downloading/previewing
   */
  async getFileStream(id: string): Promise<{ file: File; stream: ReadStream }> {
    const file = await this.getMetadata(id);

    const stream = await this.storageService.getStream(file.storagePath);

    return { file, stream };
  }

  /**
   * Get temp file stream for preview
   */
  async getTempFileStream(id: string): Promise<ReadStream> {
    const tempPath = `temp/${id}`;

    const exists = await this.storageService.exists(tempPath);
    if (!exists) {
      throw new NotFoundException('Temporary file not found');
    }

    return this.storageService.getStream(tempPath);
  }

  /**
   * Cleanup old temporary files
   * Called by scheduled task
   */
  async cleanupTempFiles(olderThan: Date): Promise<number> {
    // Find temp files older than threshold
    const oldTempFiles = await this.fileRepository.find({
      status: FileStatus.TEMP,
      createdAt: { $lt: olderThan },
    });

    let deletedCount = 0;

    for (const file of oldTempFiles) {
      try {
        // Delete from storage
        await this.storageService.delete(file.storagePath);

        // Delete from database
        await this.fileRepository.getEntityManager().removeAndFlush(file);

        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete temp file ${file.id}:`, error);
      }
    }

    return deletedCount;
  }
}
````

## File: src/main.ts
````typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
````

## File: src/meta/meta.module.ts
````typescript
import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityRegistryService } from './entity-registry.service';
import { MetadataReaderService } from './metadata-reader.service';

@Global()
@Module({
  imports: [MikroOrmModule.forFeature([])], // No specific entities here, just need provider access
  providers: [EntityRegistryService, MetadataReaderService],
  exports: [EntityRegistryService, MetadataReaderService],
})
export class MetaModule {}
````

## File: src/meta/metadata-reader.service.ts
````typescript
import { Injectable } from '@nestjs/common';
import { EntityMetadata, ReferenceKind } from '@mikro-orm/core';
import { EntityRegistryService } from './entity-registry.service';

@Injectable()
export class MetadataReaderService {
  constructor(private readonly registry: EntityRegistryService) {}

  getRelationType(collection: string, field: string): 'm:1' | '1:m' | 'm:n' | '1:1' | null {
    const meta = this.registry.getMetadata(collection);
    const prop = meta.properties[field] as any;
    
    if (!prop) return null;

    if (prop.reference === ReferenceKind.MANY_TO_ONE) return 'm:1';
    if (prop.reference === ReferenceKind.ONE_TO_MANY) return '1:m';
    if (prop.reference === ReferenceKind.MANY_TO_MANY) return 'm:n';
    if (prop.reference === ReferenceKind.ONE_TO_ONE) return '1:1';
    
    return null;
  }

  isRelation(collection: string, field: string): boolean {
    return this.getRelationType(collection, field) !== null;
  }

  getRelatedCollection(collection: string, field: string): string | null {
    const meta = this.registry.getMetadata(collection);
    const prop = meta.properties[field] as any;
    
    if (!prop || !prop.target) return null;

    // Resolve target entity metadata to get its table name
    // Note: MikroORM metadata target can be a function or string or class
    // We assume standard usage where the ORM has resolved it or we can resolve it via registry if needed
    // For now, let's treat it as the EntityName (className) and find the tableName from registry if possible
    // or relying on how MikroORM exposes it.
    
    // Actually, prop.targetMeta is the safest if populated
    if (prop.targetMeta) {
      return prop.targetMeta.tableName;
    }
    
    return null;
  }
}
````

## File: src/query/compiler/fields.compiler.ts
````typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class FieldsCompiler {
  compile(fields: string[]): any {
    // fields=['*', 'author.name', 'comments.*']
    // MikroORM needs "populate" array.
    // We assume explicit fields selection logic.
    // If fields=['*'], populate nothing? Or populate all? 
    // Directus lazy loads nothing by default unless requested.
    
    // We simply extract relations from fields to populate them.
    // 'author.name' -> populate 'author'
    // 'comments.*' -> populate 'comments'
    
    const populate = new Set<string>();
    
    for (const f of fields) {
      if (f.includes('.')) {
        const parts = f.split('.');
        populate.add(parts[0]);
        // Support 2 levels? parts[0] + '.' + parts[1]
      }
    }

    return Array.from(populate);
  }
}
````

## File: src/query/compiler/order.compiler.ts
````typescript
import { Injectable } from '@nestjs/common';
import { SortNode } from '../ast/query.ast';

@Injectable()
export class OrderCompiler {
  compile(sort: SortNode[]): any {
    if (!sort || sort.length === 0) return {};

    const orderBy: any = {};
    for (const node of sort) {
      // Handle nested sort "author.name" -> { author: { name: 'asc' } }
      // But MikroORM orderBy simple array is { field: 'ASC' } or { 'rel.field': 'ASC' }
      
      // MikroORM supports { 'author.name': 'asc' }
      orderBy[node.field] = node.direction;
    }

    return orderBy;
  }
}
````

## File: src/query/compiler/where.compiler.ts
````typescript
import { Injectable } from '@nestjs/common';
import { FilterNode, FilterOperator } from '../ast/query.ast';

@Injectable()
export class WhereCompiler {
  compile(filter: FilterNode): any {
    if (!filter || Object.keys(filter).length === 0) return {};

    const where: any = {};

    for (const key of Object.keys(filter)) {
      if (key === '_and') {
        where['$and'] = (filter[key] as any[]).map(f => this.compile(f));
      } else if (key === '_or') {
        where['$or'] = (filter[key] as any[]).map(f => this.compile(f));
      } else {
        // Field or Relation
        const value = filter[key];
        if (this.isOperatorObject(value)) {
          where[key] = this.compileOperators(value);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Nested relation filter (join)
            // MikroORM handles nested object keys as joins automatically if relation exists
            // { author: { name: { _eq: 'John' } } }
            where[key] = this.compile(value);
        } else {
            // Implicit _eq
            where[key] = value;
        }
      }
    }

    return where;
  }

  private isOperatorObject(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) return false;
    const keys = Object.keys(obj);
    // Simple check: starts with _
    return keys.some(k => k.startsWith('_'));
  }

  private compileOperators(ops: any): any {
    const result: any = {};
    for (const op of Object.keys(ops)) {
      const val = ops[op];
      switch (op as FilterOperator) {
        case '_eq': result['$eq'] = val; break;
        case '_neq': result['$ne'] = val; break;
        case '_gt': result['$gt'] = val; break;
        case '_gte': result['$gte'] = val; break;
        case '_lt': result['$lt'] = val; break;
        case '_lte': result['$lte'] = val; break;
        case '_in': result['$in'] = val; break;
        case '_nin': result['$nin'] = val; break;
        case '_contains': result['$like'] = `%${val}%`; break;
        case '_starts_with': result['$like'] = `${val}%`; break;
        // ... mapped others
        default: break;
      }
    }
    return result;
  }
}
````

## File: src/query/parser/deep.parser.ts
````typescript
import { Injectable } from '@nestjs/common';
import { DeepNode } from '../ast/query.ast';
import { FilterParser } from './filter.parser';
import { SortParser } from './sort.parser';

@Injectable()
export class DeepParser {
  constructor(
      private readonly filterParser: FilterParser,
      private readonly sortParser: SortParser,
  ) {}

  parse(deep: any): DeepNode {
    if (!deep) return {};
    // Expect deep to be an object: deep[comments][_filter][status]=active
    // In express/nestjs, qs might handle this object nesting.
    
    const result: DeepNode = {};

    for (const relation of Object.keys(deep)) {
      const relConfig = deep[relation];
      result[relation] = {};

      if (relConfig._filter) {
        const parsed = this.filterParser.parse(relConfig._filter);
        if (parsed) {
             result[relation]._filter = parsed;
        }
      }
      if (relConfig._sort) {
        result[relation]._sort = this.sortParser.parse(relConfig._sort);
      }
      if (relConfig._limit) {
        result[relation]._limit = parseInt(relConfig._limit, 10);
      }
      if (relConfig._offset) {
        result[relation]._offset = parseInt(relConfig._offset, 10);
      }
    }

    return result;
  }
}
````

## File: src/query/parser/fields.parser.ts
````typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class FieldsParser {
  // fields=*,author.name,comments.*
  parse(fields: string | string[]): string[] {
    if (!fields) return ['*'];
    
    if (Array.isArray(fields)) return fields;
    
    return fields.split(',').map(f => f.trim()).filter(f => f.length > 0);
  }
}
````

## File: src/query/parser/filter.parser.ts
````typescript
import { Injectable } from '@nestjs/common';
import { FilterNode, LogicalOperator } from '../ast/query.ast';
import { InvalidQueryException } from '../../common/exceptions/invalid-query.exception';

@Injectable()
export class FilterParser {
  parse(filter: any): FilterNode | null {
    if (!filter) return null;
    if (typeof filter === 'string') {
        try {
            filter = JSON.parse(filter);
        } catch (e) {
            throw new InvalidQueryException('Filter must be valid JSON');
        }
    }

    return this.parseNode(filter);
  }

  private parseNode(node: any): any {
    if (Object.keys(node).length === 0) return {};

    const result: any = {};

    for (const key of Object.keys(node)) {
      if (key === '_and' || key === '_or') {
        // Logical Operator
        if (!Array.isArray(node[key])) {
            throw new InvalidQueryException(`Logical operator ${key} must be an array`);
        }
        result[key] = node[key].map((child: any) => this.parseNode(child));
      } else {
        // Field or Operator or Nested Relation
        // We don't deeply validate fields here, we trust the structure is roughly correct
        // and validation happens at compile time or DB level to keep parser generic.
        result[key] = node[key];
      }
    }

    return result;
  }
}
````

## File: src/query/parser/meta.parser.ts
````typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { MetaNode } from '../ast/query.ast';

@Injectable()
export class MetaParser {
  parse(meta: string | string[]): MetaNode {
    if (!meta) {
      return {};
    }

    // Handle array or comma-separated string
    const metaValues = Array.isArray(meta) 
      ? meta 
      : meta.split(',').map(v => v.trim());

    const result: MetaNode = {};

    for (const value of metaValues) {
      if (value === '*') {
        // Wildcard: include all meta fields
        result.filter_count = true;
        result.total_count = true;
      } else if (value === 'filter_count') {
        result.filter_count = true;
      } else if (value === 'total_count') {
        result.total_count = true;
      } else if (value) {
        // Non-empty unsupported value
        throw new BadRequestException(
          `Invalid meta value: "${value}". Supported values: filter_count, total_count, *`
        );
      }
    }

    return result;
  }
}
````

## File: src/query/parser/pagination.parser.ts
````typescript
import { Injectable } from '@nestjs/common';
import { PaginationNode } from '../ast/query.ast';

@Injectable()
export class PaginationParser {
  parse(query: any): PaginationNode {
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const offset = query.offset ? parseInt(query.offset, 10) : undefined;
    const page = query.page ? parseInt(query.page, 10) : undefined;

    return { limit, offset, page };
  }
}
````

## File: src/query/parser/sort.parser.ts
````typescript
import { Injectable } from '@nestjs/common';
import { SortNode } from '../ast/query.ast';

@Injectable()
export class SortParser {
  // sort=title,-createdAt
  parse(sort: string | string[]): SortNode[] {
    if (!sort) return [];
    
    const sortParams = Array.isArray(sort) ? sort : sort.split(',');
    
    return sortParams.map(param => {
      let direction: 'asc' | 'desc' = 'asc';
      let field = param.trim();

      if (field.startsWith('-')) {
        direction = 'desc';
        field = field.substring(1);
      }

      return { field, direction };
    });
  }
}
````

## File: src/query/query-engine.service.spec.ts
````typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryEngineService } from './query-engine.service';
import { FilterParser } from './parser/filter.parser';
import { SortParser } from './parser/sort.parser';
import { PaginationParser } from './parser/pagination.parser';
import { FieldsParser } from './parser/fields.parser';
import { DeepParser } from './parser/deep.parser';
import { MetaParser } from './parser/meta.parser';
import { WhereCompiler } from './compiler/where.compiler';
import { OrderCompiler } from './compiler/order.compiler';
import { FieldsCompiler } from './compiler/fields.compiler';
import { PermissionService } from '../common/permissions/permission.service';

describe('QueryEngineService Limits', () => {
  let service: QueryEngineService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key, defaultValue) => {
        if (key === 'query.maxSortFields') return 2;
        if (key === 'query.maxConditions') return 3;
        if (key === 'query.allowRegex') return false;
        return defaultValue;
    }),
  };

  const mockPermissionService = {
      can: jest.fn().mockReturnValue({})
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryEngineService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PermissionService, useValue: mockPermissionService },
        // Mocks for dependencies not under test
        { provide: FilterParser, useValue: { parse: jest.fn(x => x) } },
        { provide: SortParser, useValue: { parse: jest.fn(x => x) } },
        { provide: PaginationParser, useValue: { parse: jest.fn(() => ({ limit: 10, offset: 0 })) } },
        { provide: FieldsParser, useValue: { parse: jest.fn() } },
        { provide: DeepParser, useValue: { parse: jest.fn() } },
        { provide: MetaParser, useValue: { parse: jest.fn() } },
        { provide: WhereCompiler, useValue: { compile: jest.fn(x => x) } }, // Passthrough for condition counting test
        { provide: OrderCompiler, useValue: { compile: jest.fn() } },
        { provide: FieldsCompiler, useValue: { compile: jest.fn() } },
      ],
    }).compile();

    service = module.get<QueryEngineService>(QueryEngineService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should throw if sort fields exceed limit', async () => {
    const context: any = {
        collection: 'users',
        query: {
            sort: { a: 'ASC', b: 'DESC', c: 'ASC' } // 3 fields, limit is 2
        }
    };

    await expect(service.parseAndCompile(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw if regex is used when disabled', async () => {
      const context: any = {
          collection: 'users',
          query: {
              filter: { name: { $regex: 'pattern' } }
          }
      };
      
      await expect(service.parseAndCompile(context)).rejects.toThrow(BadRequestException);
  });
});
````

## File: src/repository/repository.module.ts
````typescript
import { Module, Global } from '@nestjs/common';
import { GenericRepository } from './generic.repository';
import { MetaModule } from '../meta/meta.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Global()
@Module({
  imports: [MetaModule, MikroOrmModule.forFeature([])],
  providers: [GenericRepository],
  exports: [GenericRepository],
})
export class RepositoryModule {}
````

## File: src/services/reports.service.ts
````typescript
import { Injectable } from '@nestjs/common';
import { QueryEngineService } from '../query/query-engine.service';
import { GenericRepository } from '../repository/generic.repository';
import { PermissionService } from '../common/permissions/permission.service';

@Injectable()
export class ReportsService {
  constructor(
      private readonly queryEngine: QueryEngineService,
      private readonly repository: GenericRepository,
      private readonly permissionService: PermissionService
  ) {}

  async getActiveUsers(query: any) {
    // 1. Assert custom permission for this specific report
    // This demonstrates arbitrary action strings beyond CRUD
    this.permissionService.assert('reports', 'generate');

    // 2. Force a filter for "active" users (assuming we have such a field, or logic)
    // For demo, let's say "active" means email contains "active" (just as a sample constraint)
    const customFilter = { email: { _contains: 'active' } };

    // 3. Reuse Query Engine to parse user provided query (sorting, fields, etc)
    // but inject our atomic custom filter.
    const options = await this.queryEngine.parseAndCompile({
        collection: 'user', // "user" maps to User entity
        query: query
    });

    // 4. Merge custom business logic into the generic options
    // Note: options.where comes from QueryEngine which already merged Permission Filters.
    // Now we merge Business Logic Filters.
    options.where = {
        '$and': [
            options.where,
            { email: { '$like': '%active%' } } // The compiled version of our custom logic
        ]
    };

    return this.repository.find('user', options);
  }
}
````

## File: src/services/services.module.ts
````typescript
import { Module } from '@nestjs/common';
import { ItemsService } from './items.service'; // Adjust path if needed or just export provider
import { CommonModule } from '../common/common.module';
import { QueryModule } from '../query/query.module';
import { RepositoryModule } from '../repository/repository.module';
import { MetaModule } from '../meta/meta.module';
import { ItemsController } from '../controllers/items.controller';

@Module({
  imports: [CommonModule, QueryModule, RepositoryModule, MetaModule],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ServicesModule {}
````

## File: src/storage/storage.service.ts
````typescript
import { Injectable } from '@nestjs/common';
import { ReadStream } from 'fs';
import { IStorageAdapter, StorageResult } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';

/**
 * Storage service wrapper
 * Provides high-level storage operations
 */
@Injectable()
export class StorageService {
  constructor(private readonly adapter: LocalStorageAdapter) {}

  async saveTemp(
    file: Express.Multer.File,
    id: string,
  ): Promise<StorageResult> {
    return this.adapter.saveTemp(file, id);
  }

  async moveToPermanent(
    tempPath: string,
    permanentPath: string,
  ): Promise<void> {
    return this.adapter.moveToPermanent(tempPath, permanentPath);
  }

  async getStream(path: string): Promise<ReadStream> {
    return this.adapter.getStream(path);
  }

  async delete(path: string): Promise<void> {
    return this.adapter.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.adapter.exists(path);
  }

  async getSize(path: string): Promise<number> {
    return this.adapter.getSize(path);
  }
}
````

## File: test/app.e2e-spec.ts
````typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
````

## File: test/jest-e2e.json
````json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
````

## File: tsconfig.build.json
````json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
````

## File: tsconfig.json
````json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "noFallthroughCasesInSwitch": false
  }
}
````

## File: src/auth/auth.service.ts
````typescript
import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/core';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { ulid } from 'ulid';
import { User } from '../database/entities/user.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { ResetPasswordToken } from '../database/entities/reset-password-token.entity';

/**
 * AuthService - Handles authentication with split-token refresh mechanism.
 * 
 * Token Strategy:
 * - Access tokens: JWT, short-lived (15 min)
 * - Refresh tokens: Split-token format <token_id>.<token_secret>
 *   - token_id: ULID, stored in plaintext, indexed for O(1) lookup
 *   - token_secret: Random bytes, hashed with argon2
 * 
 * Security: All token verification uses O(1) indexed lookup by token_id.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly logLevel: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
  ) {
      this.logLevel = this.configService.get<string>('auth.logLevel', 'basic');
  }

  /**
   * Issue both access and refresh tokens for a user.
   * 
   * @param userId - User ID to issue tokens for
   * @returns Object with accessToken (JWT) and refreshToken (split-token)
   */
  async issueTokens(userId: number): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // 1. Generate JWT access token
    const accessToken = this.jwtService.sign({ sub: userId });

    // 2. Generate split refresh token
    const tokenId = ulid();
    const tokenSecret = randomBytes(32).toString('base64url');
    const secretHash = await argon2.hash(tokenSecret);

    // 3. Store in database
    const refreshTokenEntity = this.em.create(RefreshToken, {
      tokenId,
      secretHash,
      user: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
    await this.em.persistAndFlush(refreshTokenEntity);

    // 4. Return combined token to client
    const refreshToken = `${tokenId}.${tokenSecret}`;

    return { accessToken, refreshToken };
  }

  /**
   * Rotate refresh token - verify old token and issue new tokens.
   * 
   * Security: O(1) lookup by token_id, then constant-time verification.
   * Old token is immediately revoked.
   * 
   * @param fullToken - Full refresh token in format <token_id>.<token_secret>
   * @returns New access and refresh tokens
   */
  async rotateRefreshToken(fullToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // 1. Parse token into components
    const [tokenId, tokenSecret] = fullToken.split('.');
    
        if (!tokenId || !tokenSecret) {
          this.logAuthEvent('Refresh Failed', 'Invalid token format');
          throw new UnauthorizedException('Invalid token format');
        }
    
        // 2. O(1) lookup by token_id (SINGLE ROW QUERY)
        const storedToken = await this.em.findOne(RefreshToken, {
          tokenId,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        });
    
        if (!storedToken) {
           this.logAuthEvent('Refresh Failed', `Token not found or expired: ${tokenId}`);
          throw new UnauthorizedException('Invalid or expired refresh token');
        }
    
        // 3. Verify secret using constant-time comparison
        const isValid = await argon2.verify(storedToken.secretHash, tokenSecret);
    
        if (!isValid) {
          this.logAuthEvent('Refresh Failed', `Invalid secret for token: ${tokenId}`);
          throw new UnauthorizedException('Invalid refresh token');
        }
    
        // 4. Revoke old token immediately
        storedToken.revokedAt = new Date();
        this.logAuthEvent('Token Rotated', `User: ${storedToken.user.id}, Old Token: ${tokenId}`);
    
        // 5. Issue new tokens
        const newTokens = await this.issueTokens(storedToken.user.id);
    
        await this.em.flush();
    
        return newTokens;
  }

  /**
   * Revoke a refresh token (used for logout).
   * 
   * @param fullToken - Full refresh token to revoke
   */
  async revokeRefreshToken(fullToken: string): Promise<void> {
    const [tokenId, tokenSecret] = fullToken.split('.');

    if (!tokenId || !tokenSecret) {
      return; // Silent fail for logout
    }

    // O(1) lookup
    const storedToken = await this.em.findOne(RefreshToken, {
      tokenId,
      revokedAt: null,
    });

    if (!storedToken) {
      return; // Already revoked or doesn't exist
    }

    // Verify secret
    const isValid = await argon2.verify(storedToken.secretHash, tokenSecret);

    if (!isValid) {
      return; // Invalid token, nothing to revoke
    }

    // Revoke
    storedToken.revokedAt = new Date();
    await this.em.flush();
  }

  /**
   * Create a reset password token for a user.
   * Invalidates any existing reset tokens for this user.
   * 
   * @param userId - User ID to create reset token for
   * @returns Reset token in format <token_id>.<token_secret>
   */
  async createResetPasswordToken(userId: number): Promise<string> {
    // 1. Invalidate any existing reset tokens for this user
    await this.em.nativeUpdate(
      ResetPasswordToken,
      { user: userId, usedAt: null },
      { usedAt: new Date() }
    );

    // 2. Generate split token
    const tokenId = ulid();
    const tokenSecret = randomBytes(32).toString('base64url');
    const secretHash = await argon2.hash(tokenSecret);

    // 3. Store in database
    const resetTokenEntity = this.em.create(ResetPasswordToken, {
      tokenId,
      secretHash,
      user: userId,
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
    });
    await this.em.persistAndFlush(resetTokenEntity);

    // 4. Return combined token
    return `${tokenId}.${tokenSecret}`;
  }

  /**
   * Reset user password using a reset token.
   * Token is one-time use only.
   * 
   * @param fullToken - Reset token in format <token_id>.<token_secret>
   * @param newPassword - New password (will be hashed)
   */
  async resetPassword(fullToken: string, newPassword: string): Promise<void> {
    // 1. Parse token
    const [tokenId, tokenSecret] = fullToken.split('.');

    if (!tokenId || !tokenSecret) {
      throw new BadRequestException('Invalid token format');
    }

    // 2. O(1) lookup
    const storedToken = await this.em.findOne(ResetPasswordToken, {
      tokenId,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!storedToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // 3. Verify secret
    const isValid = await argon2.verify(storedToken.secretHash, tokenSecret);

    if (!isValid) {
      throw new BadRequestException('Invalid reset token');
    }

    // 4. Mark as used (one-time use)
    storedToken.usedAt = new Date();

    // 5. Update password
    const passwordHash = await argon2.hash(newPassword);
    await this.em.nativeUpdate(
      User,
      { id: storedToken.user.id },
      { password: passwordHash }
    );

    await this.em.flush();
  }

  /**
   * Login user with email and password.
   * 
   * @param email - User email
   * @param password - User password (plaintext)
   * @returns Access and refresh tokens
   */
  async login(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.em.findOne(User, { email });

    if (!user || !user.password) {
      this.logAuthEvent('Login Failed', `Invalid credentials for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.password, password);

    if (!isValid) {
      this.logAuthEvent('Login Failed', `Invalid password for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logAuthEvent('Login Success', `User: ${user.id}`);
    return this.issueTokens(user.id);
  }

  /**
   * Get user by ID (for /auth/me endpoint).
   * 
   * @param userId - User ID
   * @returns User object
   */
  async getMe(userId: number): Promise<User> {
    const user = await this.em.findOne(User, { id: userId });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private logAuthEvent(event: string, details: string) {
      if (this.logLevel === 'verbose' || event.includes('Failed') || event.includes('Reset')) {
          this.logger.log(`[${event}] ${details}`);
      }
  }
}
````

## File: src/common/permissions/permission.service.ts
````typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { RequestContext } from '../context/request.context';
import { User } from '../../database/entities/user.entity';
import { Permission } from '../../database/entities/permission.entity';

@Injectable()
export class PermissionService {
  constructor(
    private readonly context: RequestContext,
    private readonly em: EntityManager,
  ) {}

  /**
   * Assert that the user has permission to perform action(s) on collection.
   * Throws ForbiddenException if denied.
   * 
   * @param collection - Collection or virtual scope name
   * @param action - Single action or array of actions (ALL must pass)
   */
  async assert(collection: string, action: string | string[]): Promise<void> {
    const actions = Array.isArray(action) ? action : [action];
    
    for (const act of actions) {
      const result = await this.can(collection, act);
      
      // If can() returns false or throws, deny
      if (result === false) {
        throw new ForbiddenException(
          `Permission denied: ${act} on ${collection}`
        );
      }
      
      // If can() returns a filter object with constraints, we can't enforce it here
      // (assert is for boolean checks, not filter-based row-level security)
      // For now, we allow it if it returns an object (truthy)
    }
  }

  /**
   * Check if the current user has permission to perform action on collection.
   * 
   * This method resolves the permission chain:
   * 1. Get current user from RequestContext
   * 2. Load user's roles (via users_roles join table)
   * 3. Load permissions for those roles (via roles_permissions join table)
   * 4. Check if any permission matches (collection, action) pair
   * 
   * Returns:
   * - {} (empty object) = allowed with no row-level filters
   * - { filter } = allowed with row-level constraints (future enhancement)
   * - false = denied
   * 
   * @param collection - Collection or virtual scope name (e.g., 'post', 'user', 'reports')
   * @param action - Arbitrary action string (e.g., 'read', 'create', 'export', 'publish')
   * 
   * NOTE: Actions are extensible strings, not limited to CRUD operations.
   * This allows domain-specific permissions like 'publish', 'approve', 'export', etc.
   */
  async can(collection: string, action: string): Promise<any> {
    const user = this.context.user;
    
    // TODO: Add caching layer here to avoid repeated database queries
    // Extension point: Implement Redis/in-memory cache for user permissions
    // Cache key: `user:${userId}:permissions` with TTL
    
    // Public/anonymous access - no user in context
    if (!user || !user.id) {
      // For demo: allow read on certain collections for public users
      // In production, check for a "public" or "anonymous" role in the database
      if (action === 'read' && ['post', 'comment'].includes(collection)) {
        if (collection === 'post') return { status: 'published' };
        return {};
      }
      return false; // Deny by default
    }

    // Load user with roles and permissions from database
    // This performs the RBAC resolution: user → roles → permissions
    const userWithRoles = await this.em.findOne(
      User,
      { id: Number(user.id) },
      {
        populate: ['roles', 'roles.permissions'],
      }
    );

    if (!userWithRoles) {
      return false; // User not found
    }

    // Check if user has a role with the required permission
    // Iterate through all roles assigned to the user
    for (const role of userWithRoles.roles) {
      // Check if this role has a permission matching (collection, action)
      const hasPermission = role.permissions.getItems().some(
        (permission: Permission) =>
          permission.collection === collection && permission.action === action
      );

      if (hasPermission) {
        // Permission granted - return empty object (no row-level filters)
        // TODO: Future enhancement - return filter constraints for row-level security
        // Example: return { authorId: user.id } to limit to user's own records
        return {};
      }
    }

    // No matching permission found - deny access
    return false;
  }

  /**
   * Helper method to check if user has a specific role by name.
   * Useful for simple role-based checks without full permission resolution.
   * 
   * @param roleName - Name of the role to check (e.g., 'admin', 'editor')
   */
  async hasRole(roleName: string): Promise<boolean> {
    const user = this.context.user;
    
    if (!user || !user.id) {
      return false;
    }

    const userWithRoles = await this.em.findOne(
      User,
      { id: Number(user.id) },
      {
        populate: ['roles'],
      }
    );

    if (!userWithRoles) {
      return false;
    }

    return userWithRoles.roles.getItems().some(role => role.name === roleName);
  }
}
````

## File: src/database/entities/comment.entity.ts
````typescript
import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { User } from './user.entity';
import { Post } from './post.entity';

@Entity({ tableName: 'comments' })
export class Comment {
  @PrimaryKey()
  id!: number;

  @Property({ type: 'text' })
  body!: string;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @ManyToOne(() => User)
  author!: User;

  @ManyToOne(() => Post)
  post!: Post;
}
````

## File: src/database/entities/permission.entity.ts
````typescript
import {
  Entity,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
  Index,
} from '@mikro-orm/core';
import { Role } from './role.entity';

/**
 * Permission entity for RBAC system.
 * 
 * Permissions are defined by (collection, action) pairs:
 * - collection: The entity/resource scope (e.g., 'post', 'user', 'report')
 * - action: The operation allowed (e.g., 'read', 'create', 'delete', 'export', 'publish')
 * 
 * WHY (collection + action)?
 * This design provides flexibility and extensibility:
 * 1. Collections map to entities or logical scopes (not just database tables)
 * 2. Actions are extensible strings, not limited to CRUD operations
 * 3. Custom actions can be added without schema changes (e.g., 'export', 'publish', 'approve')
 * 4. Supports virtual collections for cross-entity operations (e.g., 'reports', 'analytics')
 * 
 * WHY actions are strings?
 * - Extensible: Add new actions without modifying the schema
 * - Flexible: Support domain-specific actions beyond CRUD
 * - Simple: Easy to understand and query
 * 
 * Examples:
 * - ('post', 'read') - Can read posts
 * - ('post', 'publish') - Can publish posts (custom action)
 * - ('user', 'delete') - Can delete users
 * - ('reports', 'export') - Can export reports (virtual collection)
 */
@Entity({ tableName: 'permissions' })
@Index({ properties: ['collection', 'action'] }) // Composite index for efficient permission lookups
export class Permission {
  @PrimaryKey()
  id!: number;

  /**
   * The entity or logical scope this permission applies to.
   * Examples: 'post', 'user', 'comment', 'reports', 'analytics'
   * Can be entity names or virtual scopes for grouped operations.
   */
  @Property()
  collection!: string;

  /**
   * The action/operation allowed on the collection.
   * Extensible string - not limited to CRUD operations.
   * Examples: 'read', 'create', 'update', 'delete', 'publish', 'export', 'approve'
   */
  @Property()
  action!: string;

  /**
   * Optional human-readable description of what this permission grants
   */
  @Property({ nullable: true })
  description?: string;

  /**
   * Roles that have this permission (many-to-many)
   * Managed via roles_permissions join table
   */
  @ManyToMany(() => Role, (role) => role.permissions)
  roles = new Collection<Role>(this);
}
````

## File: src/database/entities/post.entity.ts
````typescript
import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Enum } from '@mikro-orm/core';
import { User } from './user.entity';
import { Comment } from './comment.entity';

@Entity({ tableName: 'posts' })
export class Post {
  @PrimaryKey()
  id!: number;

  @Property()
  title!: string;

  @Property({ type: 'text' })
  content!: string;

  @Property()
  status: string = 'draft';

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  @ManyToOne(() => User)
  author!: User;

  @OneToMany(() => Comment, comment => comment.post)
  comments = new Collection<Comment>(this);
}
````

## File: src/database/entities/refresh-token.entity.ts
````typescript
import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { User } from './user.entity';

/**
 * Refresh Token entity for split-token authentication.
 * 
 * Token format: <token_id>.<token_secret>
 * - token_id: ULID stored in plaintext, indexed for O(1) lookup
 * - token_secret: Random bytes, hashed with argon2 before storage
 * 
 * Security: Never query by secret_hash. Always lookup by token_id first.
 */
@Entity({ tableName: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryKey()
  id!: number;

  /**
   * Token identifier (ULID format, 26 characters)
   * - Stored in plaintext
   * - Indexed for O(1) lookup
   * - Unique constraint prevents collisions
   */
  @Property({ unique: true, length: 26 })
  @Index()
  tokenId!: string;

  /**
   * Hashed token secret (argon2)
   * - Never stored in plaintext
   * - Used only for verification after lookup by tokenId
   * - NOT indexed (never queried directly)
   */
  @Property()
  secretHash!: string;

  @ManyToOne(() => User)
  user!: User;

  @Property()
  expiresAt!: Date;

  /**
   * Revocation timestamp
   * - NULL = active token
   * - timestamp = revoked token (cannot be used)
   */
  @Property({ nullable: true })
  revokedAt?: Date;

  @Property({ onCreate: () => new Date() })
  createdAt?: Date
}
````

## File: src/database/entities/reset-password-token.entity.ts
````typescript
import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { User } from './user.entity';

/**
 * Reset Password Token entity for split-token password reset flow.
 * 
 * Token format: <token_id>.<token_secret>
 * - token_id: ULID stored in plaintext, indexed for O(1) lookup
 * - token_secret: Random bytes, hashed with argon2 before storage
 * 
 * Security: One-time use only. Old tokens invalidated when new one is created.
 */
@Entity({ tableName: 'reset_password_tokens' })
export class ResetPasswordToken {
  @PrimaryKey()
  id!: number;

  /**
   * Token identifier (ULID format, 26 characters)
   * - Stored in plaintext
   * - Indexed for O(1) lookup
   * - Unique constraint prevents collisions
   */
  @Property({ unique: true, length: 26 })
  @Index()
  tokenId!: string;

  /**
   * Hashed token secret (argon2)
   * - Never stored in plaintext
   * - Used only for verification after lookup by tokenId
   * - NOT indexed (never queried directly)
   */
  @Property()
  secretHash!: string;

  @ManyToOne(() => User)
  user!: User;

  @Property()
  expiresAt!: Date;

  /**
   * One-time use tracking
   * - NULL = unused token
   * - timestamp = token has been used (cannot be reused)
   */
  @Property({ nullable: true })
  usedAt?: Date;

  @Property({ onCreate: () => new Date() })
  createdAt?: Date;
}
````

## File: src/database/entities/role.entity.ts
````typescript
import {
  Entity,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
} from '@mikro-orm/core';
import { User } from './user.entity';
import { Permission } from './permission.entity';

/**
 * Role entity for RBAC system.
 * Roles group permissions and are assigned to users.
 * Examples: 'admin', 'editor', 'viewer', 'custom_role'
 */
@Entity({ tableName: 'roles' })
export class Role {
  @PrimaryKey()
  id!: number;

  /**
   * Unique role name (e.g., 'admin', 'editor')
   * Used for role identification and assignment
   */
  @Property({ unique: true })
  name!: string;

  /**
   * Optional human-readable description of the role's purpose
   */
  @Property({ nullable: true })
  description?: string;

  /**
   * Users assigned to this role (many-to-many)
   * Managed via users_roles join table
   */
  @ManyToMany(() => User, (user) => user.roles)
  users = new Collection<User>(this);

  /**
   * Permissions granted by this role (many-to-many)
   * Managed via roles_permissions join table
   */
  @ManyToMany(() => Permission, (permission) => permission.roles, {
    owner: true,
  })
  permissions = new Collection<Permission>(this);
}
````

## File: src/meta/entity-registry.service.ts
````typescript
import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { MikroORM, EntityMetadata } from '@mikro-orm/core';

@Injectable()
export class EntityRegistryService implements OnModuleInit {
  private readonly logger = new Logger(EntityRegistryService.name);
  private readonly collectionMap = new Map<string, string>(); // collectionName -> EntityClassName
  private readonly entityMap = new Map<string, EntityMetadata>(); // EntityClassName -> Metadata

  constructor(private readonly orm: MikroORM) {}

  async onModuleInit() {
    this.scanEntities();
  }

  private scanEntities() {
    const metadata = this.orm.getMetadata().getAll();
    for (const meta of Object.values(metadata)) {
      // Use tableName as the collection identifier
      const collectionName = meta.tableName;
      const entityName = meta.className;

      if (!collectionName) {
        continue;
      }

      this.collectionMap.set(collectionName, entityName);
      this.entityMap.set(entityName, meta);
      
      this.logger.log(`Registered collection: ${collectionName} -> ${entityName}`);
    }
  }

  getEntityName(collection: string): string {
    const entityName = this.collectionMap.get(collection);
    if (!entityName) {
      throw new NotFoundException(`Collection ${collection} not found`);
    }
    return entityName;
  }

  getMetadata(collection: string): EntityMetadata {
    const entityName = this.getEntityName(collection);
    return this.entityMap.get(entityName)!;
  }

  hasCollection(collection: string): boolean {
    console.log("collectionMap",this.collectionMap);
    return this.collectionMap.has(collection);
  }
}
````

## File: src/query/ast/query.ast.ts
````typescript
// AST Definitions

export type FilterOperator = 
  | '_eq' | '_neq' | '_gt' | '_gte' | '_lt' | '_lte'
  | '_in' | '_nin' | '_contains' | '_starts_with'
  | '_null' | '_nnull' | '_empty' | '_nempty';

export type LogicalOperator = '_and' | '_or';

export interface FilterNode {
  [key: string]: any; // Recursive structure
}

export interface SortNode {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationNode {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface DeepNode {
  [relation: string]: {
    _filter?: FilterNode;
    _sort?: SortNode[];
    _limit?: number;
    _offset?: number;
  };
}

export type MetaField = 'filter_count' | 'total_count';

export interface MetaNode {
  filter_count?: boolean;
  total_count?: boolean;
}

export interface QueryContext {
  collection: string;
  query: Record<string, any>; // Raw query params
}

export interface ParsedQuery {
  filter: FilterNode;
  sort: SortNode[];
  pagination: PaginationNode;
  fields: string[]; // List of fields to select/populate
  deep: DeepNode;
  meta: MetaNode;
  // TODO: Aggregation
  aggregate?: {
    count?: string[]; // Fields to count, or ['*']
  };
}
````

## File: src/repository/generic.repository.ts
````typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { MikroORM, QueryOrderMap } from '@mikro-orm/core';
import { EntityRegistryService } from '../meta/entity-registry.service';

@Injectable()
export class GenericRepository {
  constructor(
    private readonly orm: MikroORM,
    private readonly registry: EntityRegistryService,
  ) {}

  private getRepo(collection: string) {
    const entityName = this.registry.getEntityName(collection);
    return this.orm.em.getRepository(entityName);
  }

  async find(collection: string, options: { 
      where: any, 
      orderBy?: QueryOrderMap<any>, 
      limit?: number, 
      offset?: number, 
      populate?: string[] 
  }) {
    const repo = this.getRepo(collection);
    return repo.find(options.where, {
      orderBy: options.orderBy,
      limit: options.limit,
      offset: options.offset,
      populate: options.populate as any,
    });
  }

  /**
   * Optimized method for queries with meta requirements.
   * Uses MikroORM's findAndCount to get data + count in a single query.
   * 
   * @returns [data[], count] tuple
   */
  async findAndCount(collection: string, options: { 
      where: any, 
      orderBy?: QueryOrderMap<any>, 
      limit?: number, 
      offset?: number, 
      populate?: string[] 
  }): Promise<[any[], number]> {
    const repo = this.getRepo(collection);
    return repo.findAndCount(options.where, {
      orderBy: options.orderBy,
      limit: options.limit,
      offset: options.offset,
      populate: options.populate as any,
    });
  }

  async findOne(collection: string, id: string | number, options: { populate?: string[] } = {}) {
    const repo = this.getRepo(collection);
    const item = await repo.findOne(id, { populate: options.populate as any });
    if (!item) {
        throw new NotFoundException(`Item ${id} in ${collection} not found`);
    }
    return item;
  }

  async count(collection: string, where: any): Promise<number> {
    const repo = this.getRepo(collection);
    return repo.count(where);
  }

  // WRITE - Uses EntityManager
  async create(collection: string, data: any): Promise<any> {
    const entityName = this.registry.getEntityName(collection);
    const entity = this.orm.em.create(entityName, data);
    await this.orm.em.persistAndFlush(entity);
    return entity;
  }

  async update(collection: string, id: string | number, data: any): Promise<any> {
    const repo = this.getRepo(collection);
    const item = await repo.findOne(id);
    if (!item) {
      throw new NotFoundException();
    }
    this.orm.em.assign(item, data);
    await this.orm.em.persistAndFlush(item);
    return item;
  }

  async delete(collection: string, id: string | number): Promise<void> {
    const repo = this.getRepo(collection);
    const item = await repo.getReference(id);
    await this.orm.em.removeAndFlush(item);
  }
}
````

## File: src/services/items.service.ts
````typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { GenericRepository } from '../repository/generic.repository';
import { QueryEngineService } from '../query/query-engine.service';
import { PermissionService } from '../common/permissions/permission.service';
import { EntityRegistryService } from '../meta/entity-registry.service';

@Injectable()
export class ItemsService {
  constructor(
    private readonly repository: GenericRepository,
    private readonly queryEngine: QueryEngineService,
    private readonly permissionService: PermissionService,
    private readonly registry: EntityRegistryService,
  ) {}

  private validateCollection(collection: string) {
    if (!this.registry.hasCollection(collection)) {
      throw new BadRequestException(`Collection ${collection} does not exist`);
    }
  }

  async findMany(collection: string, query: any) {
    this.validateCollection(collection);
    
    const options = await this.queryEngine.parseAndCompile({
      collection,
      query,
    });
    // Check if meta is requested
    const hasMeta = options.meta && (options.meta.filter_count || options.meta.total_count);
    if (!hasMeta) {
      // No meta requested - return data directly (backward compatible)
      const data = await this.repository.find(collection, options);
      return data;
    }
    // Optimize: Use findAndCount when filter_count is needed
    // This gets both data and filter_count in a single query
    let data: any[];
    let filterCount: number | undefined;
    if (options.meta.filter_count) {
      // Single optimized query for data + filter_count
      [data, filterCount] = await this.repository.findAndCount(collection, options);
    } else {
      // Only total_count needed, use regular find
      data = await this.repository.find(collection, options);
    }
    // Build meta object with only requested fields
    const meta: any = {};
    if (options.meta.filter_count) {
      meta.filter_count = filterCount;
    }
    if (options.meta.total_count) {
      // Separate query for total count (no filters)
      meta.total_count = await this.repository.count(collection, {});
    }
    // Return structured response
    return {
      data,
      meta,
    };
  }

  async findOne(collection: string, id: string | number, query: any) {
    this.validateCollection(collection);
    
    // We treat findOne as a findMany with a specific ID filter + read permissions
    const options = await this.queryEngine.parseAndCompile({
        collection,
        query,
    });
    
    // We explicitly use findOne from repo but we use the populate options from the query engine.
    // Security note: We should also apply the WHERE clause from permissions!
    // But repo.findOne usually just takes ID.
    // If we want to strictly enforce row-level permissions on single item fetch,
    // we should validte the item matches the permission filters.
    // Or just use findMany with ID filter and limit 1.
    // For now, let's use check permissions explicitly or trust the generic Find.
    
    // Simple verification check:
    const permissionFilter = this.permissionService.can(collection, 'read');
    if (Object.keys(permissionFilter).length > 0) {
        // If there are row-level constraints, we MUST query with them.
        options.where = { ...options.where, id };
        // Use findMany to respect the where clause
        const results = await this.repository.find(collection, { ...options, limit: 1 });
        if (results.length === 0) {
            throw new BadRequestException('Not found or forbidden');
        }
        return results[0];
    }

    return this.repository.findOne(collection, id, { populate: options.populate });
  }

  async create(collection: string, data: any) {
    this.validateCollection(collection);
    this.permissionService.assert(collection, 'create');
    return this.repository.create(collection, data);
  }

  async update(collection: string, id: string | number, data: any) {
    this.validateCollection(collection);
    this.permissionService.assert(collection, 'update');
    // TODO: Row-level update permissions check?
    // Usually requires fetching the item first and checking if it meets criteria.
    return this.repository.update(collection, id, data);
  }

  async delete(collection: string, id: string | number) {
    this.validateCollection(collection);
    this.permissionService.assert(collection, 'delete');
    return this.repository.delete(collection, id);
  }
}
````

## File: src/storage/local-storage.adapter.ts
````typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs, createReadStream, ReadStream } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import {
  IStorageAdapter,
  StorageResult,
} from './storage.interface';

/**
 * Local filesystem storage adapter
 * Handles file operations using Node.js fs module with streaming
 */
@Injectable()
export class LocalStorageAdapter implements IStorageAdapter {
  private readonly storagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath =
      this.configService.get<string>('FILE_STORAGE_PATH') || './storage';
  }

  async upload(file: Express.Multer.File, path: string): Promise<StorageResult> {
    const fullPath = join(this.storagePath, path);
    await this.ensureDir(dirname(fullPath));
    await fs.writeFile(fullPath, file.buffer);
    return {
        storedName: path.split('/').pop() || path,
        storagePath: path,
        size: file.size,
    };
  }

  async getSignedUrl(path: string): Promise<string> {
      // For local storage, we just return the relative path. 
      // In a real app, this might need to be prefixed with the API host URL 
      // or mapped to a static file serve route.
      return path;
  }

  /**
   * Save uploaded file to temporary storage
   */
  async saveTemp(
    file: Express.Multer.File,
    id: string,
  ): Promise<StorageResult> {
    const tempDir = join(this.storagePath, 'temp');
    await this.ensureDir(tempDir);

    const storedName = id;
    const storagePath = `temp/${storedName}`;
    const fullPath = join(this.storagePath, storagePath);

    // Write file using stream (no memory buffering)
    await fs.writeFile(fullPath, file.buffer);

    return {
      storedName,
      storagePath,
      size: file.size,
    };
  }

  /**
   * Move file from temp to permanent storage
   * Uses atomic rename operation when possible
   */
  async moveToPermanent(
    tempPath: string,
    permanentPath: string,
  ): Promise<void> {
    const fullTempPath = join(this.storagePath, tempPath);
    const fullPermanentPath = join(this.storagePath, permanentPath);

    // Ensure permanent directory exists
    await this.ensureDir(dirname(fullPermanentPath));

    // Atomic move (rename syscall)
    await fs.rename(fullTempPath, fullPermanentPath);
  }

  /**
   * Get readable stream for file
   * Enables streaming without loading entire file into memory
   */
  async getStream(path: string): Promise<ReadStream> {
    const fullPath = join(this.storagePath, path);

    // Verify file exists before creating stream
    await fs.access(fullPath);

    return createReadStream(fullPath);
  }

  /**
   * Delete file from storage
   */
  async delete(path: string): Promise<void> {
    const fullPath = join(this.storagePath, path);
    await fs.unlink(fullPath);
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      const fullPath = join(this.storagePath, path);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size in bytes
   */
  async getSize(path: string): Promise<number> {
    const fullPath = join(this.storagePath, path);
    const stats = await fs.stat(fullPath);
    return stats.size;
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
````

## File: src/storage/storage.interface.ts
````typescript
import { ReadStream } from 'fs';

export interface StorageResult {
  storedName: string;
  storagePath: string;
  size: number;
}

/**
 * Storage adapter interface for abstracting file storage operations
 * Enables swapping between local filesystem, S3, GCS, etc.
 */
export interface IStorageAdapter {
  /**
   * Save file to storage (Generic Upload)
   * This is the preferred method for general upload usage.
   */
  upload?(file: Express.Multer.File, path: string): Promise<StorageResult>;

  /**
   * Get a signed URL for public or temporary access.
   * For local storage, this might return a relative publicly accessible path.
   */
  getSignedUrl?(path: string, expiresIn?: number): Promise<string>;

  /**
   * Save file to temporary storage
   * @param file Multer file object
   * @param id ULID identifier for the file
   * @returns Storage metadata
   */
  saveTemp(file: Express.Multer.File, id: string): Promise<StorageResult>;

  /**
   * Move file from temporary to permanent storage
   * @param tempPath Temporary storage path
   * @param permanentPath Permanent storage path
   */
  moveToPermanent(tempPath: string, permanentPath: string): Promise<void>;

  /**
   * Get a readable stream for a file
   * @param path Storage path
   * @returns Readable stream
   */
  getStream(path: string): Promise<ReadStream>;

  /**
   * Delete a file from storage
   * @param path Storage path
   */
  delete(path: string): Promise<void>;

  /**
   * Check if file exists in storage
   * @param path Storage path
   * @returns True if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file size
   * @param path Storage path
   * @returns File size in bytes
   */
  getSize(path: string): Promise<number>;
}
````

## File: mikro-orm.config.ts
````typescript
import 'dotenv/config'; // Ensure .env is loaded for CLI
import { defineConfig } from '@mikro-orm/postgresql';
import { User } from './src/database/entities/user.entity';
import { Post } from './src/database/entities/post.entity';
import { Comment } from './src/database/entities/comment.entity';
import { Role } from './src/database/entities/role.entity';
import { Permission } from './src/database/entities/permission.entity';
import { RefreshToken } from './src/database/entities/refresh-token.entity';
import { ResetPasswordToken } from './src/database/entities/reset-password-token.entity';
import { File } from './src/database/entities/file.entity';

export default defineConfig({
  entities: [User, Post, Comment, Role, Permission, RefreshToken, ResetPasswordToken, File],
  dbName: process.env.DB_NAME || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  debug: process.env.NODE_ENV !== 'production',
  allowGlobalContext: process.env.DB_ALLOW_GLOBAL_CONTEXT === 'true', // CLI/Migration usage
  migrations: {
    path: './src/database/migrations',
    pathTs: './src/database/migrations',
  },
});
````

## File: package.json
````json
{
  "name": "nestjs-base-be",
  "version": "0.0.1",
  "description": "",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "migration:create": "mikro-orm migration:create",
    "migration:up": "mikro-orm migration:up",
    "migration:down": "mikro-orm migration:down"
  },
  "dependencies": {
    "@mikro-orm/core": "^6.6.4",
    "@mikro-orm/nestjs": "^6.1.1",
    "@mikro-orm/postgresql": "^6.6.4",
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.0.1",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/schedule": "^6.1.0",
    "argon2": "^0.44.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.3",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "ulid": "^3.0.2"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@eslint/js": "^9.18.0",
    "@mikro-orm/cli": "^6.6.4",
    "@mikro-orm/migrations": "^6.6.4",
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/multer": "^2.0.0",
    "@types/node": "^22.10.7",
    "@types/passport-jwt": "^4.0.1",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-prettier": "^5.2.2",
    "globals": "^16.0.0",
    "jest": "^30.0.0",
    "prettier": "^3.4.2",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
````

## File: src/database/entities/user.entity.ts
````typescript
import { Entity, PrimaryKey, Property, OneToMany, ManyToMany, Collection, Cascade } from '@mikro-orm/core';
import { Post } from './post.entity';
import { Comment } from './comment.entity';
import { Role } from './role.entity';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ unique: true })
  email!: string;

  /**
   * Hashed password for authentication
   * Should be hashed using bcrypt or similar before storage
   */
  @Property({ hidden: true }) // Hidden from serialization by default
  password!: string;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  @OneToMany(() => Post, post => post.author, { cascade: [Cascade.ALL] })
  posts = new Collection<Post>(this);

  @OneToMany(() => Comment, comment => comment.author)
  comments = new Collection<Comment>(this);

  /**
   * Roles assigned to this user (many-to-many)
   * Managed via users_roles join table
   */
  @ManyToMany(() => Role, (role) => role.users, { owner: true })
  roles = new Collection<Role>(this);
}
````

## File: src/query/query-engine.service.ts
````typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilterParser } from './parser/filter.parser';
import { SortParser } from './parser/sort.parser';
import { PaginationParser } from './parser/pagination.parser';
import { FieldsParser } from './parser/fields.parser';
import { DeepParser } from './parser/deep.parser';
import { MetaParser } from './parser/meta.parser';
import { WhereCompiler } from './compiler/where.compiler';
import { OrderCompiler } from './compiler/order.compiler';
import { FieldsCompiler } from './compiler/fields.compiler';
import { ParsedQuery, QueryContext } from './ast/query.ast';
import { PermissionService } from '../common/permissions/permission.service';

@Injectable()
export class QueryEngineService {
  constructor(
    private readonly filterParser: FilterParser,
    private readonly sortParser: SortParser,
    private readonly paginationParser: PaginationParser,
    private readonly fieldsParser: FieldsParser,
    private readonly deepParser: DeepParser,
    private readonly metaParser: MetaParser,
    private readonly whereCompiler: WhereCompiler,
    private readonly orderCompiler: OrderCompiler,
    private readonly fieldsCompiler: FieldsCompiler,
    private readonly permissionService: PermissionService,
    private readonly configService: ConfigService,
  ) {}

  async parseAndCompile(context: QueryContext): Promise<any> {
    const { collection, query } = context;

    // 0. Safety Checks (Hardening)
    const maxDepth = this.configService.get<number>('query.maxDepth', 3);
    const maxConditions = this.configService.get<number>('query.maxConditions', 20);
    const maxSortFields = this.configService.get<number>('query.maxSortFields', 3);
    const allowRegex = this.configService.get<boolean>('query.allowRegex', false);

    // Check Sort Fields Limit
    if (query.sort) {
        const sortKeys = Object.keys(query.sort);
        if (sortKeys.length > maxSortFields) {
            throw new BadRequestException(`Exceeded maximum sort fields limit of ${maxSortFields}`);
        }
    }

    // Check Regex Safety
    if (!allowRegex) {
        // Simple recursive check or check stringified query for regex operators if feasible 
        // For now, checks will happen in parsers/compilers ideally, but here is a high level guard
        const queryStr = JSON.stringify(query.filter);
        if (queryStr.includes('"$regex"') || queryStr.includes('"$iregex"')) {
             throw new BadRequestException('Regex queries are disabled by configuration');
        }
    }

    // 1. Permissions (Pre-flight check)
    // Get mandatory filters from permission service
    const permissionFilter = this.permissionService.can(collection, 'read');

    // 2. Parse Standard Params
    const parsed: ParsedQuery = {
      filter: this.filterParser.parse(query.filter) || {},
      sort: this.sortParser.parse(query.sort),
      pagination: this.paginationParser.parse(query),
      fields: this.fieldsParser.parse(query.fields),
      deep: this.deepParser.parse(query.deep),
      meta: this.metaParser.parse(query.meta),
    };

    // 3. Compile
    // Merge permission filter into user filter with AND
    const finalFilter = {
      _and: [
        parsed.filter,
        permissionFilter
      ]
    };
    
    // Clean up empty objects
    if (Object.keys(parsed.filter).length === 0 && Object.keys(permissionFilter).length === 0) {
        // If both empty, just {}
    }

    const where = this.whereCompiler.compile(finalFilter);

    // Validate Condition Count (Heuristic based on keys in compiled where)
    // This is rough approximation. For accurate count, we'd need to walk the 'where' object.
    const conditionCount = this.countConditions(where);
    if (conditionCount > maxConditions) {
        throw new BadRequestException(`Exceeded maximum query conditions limit of ${maxConditions}`);
    }

    const orderBy = this.orderCompiler.compile(parsed.sort);
    const populate = this.fieldsCompiler.compile(parsed.fields);

    // Deep merge deep params into populate?
    // For now, simpler implementation:
    // If we have deep params, we might need a specific populate strategy or loading strategy.
    
    return {
      where,
      orderBy,
      limit: parsed.pagination.limit,
      offset: parsed.pagination.offset,
      populate, // Basic population based on fields
      meta: parsed.meta, // Pass meta requirements to service layer
    };
  }

  private countConditions(where: any): number {
      if (!where || typeof where !== 'object') return 0;
      if (Array.isArray(where)) return where.reduce((acc, curr) => acc + this.countConditions(curr), 0);
      
      let count = 0;
      for (const key in where) {
          if (key.startsWith('$')) { // Operator
              count++;
          }
           count += this.countConditions(where[key]);
      }
      return count + (Object.keys(where).length > 0 ? 1 : 0); // Count specific field matches too
  }
}
````

## File: src/query/query.module.ts
````typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilterParser } from './parser/filter.parser';
import { SortParser } from './parser/sort.parser';
import { PaginationParser } from './parser/pagination.parser';
import { FieldsParser } from './parser/fields.parser';
import { DeepParser } from './parser/deep.parser';
import { MetaParser } from './parser/meta.parser';
import { WhereCompiler } from './compiler/where.compiler';
import { OrderCompiler } from './compiler/order.compiler';
import { FieldsCompiler } from './compiler/fields.compiler';
import { QueryEngineService } from './query-engine.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule, ConfigModule],
  providers: [
    FilterParser, SortParser, PaginationParser, FieldsParser, DeepParser, MetaParser,
    WhereCompiler, OrderCompiler, FieldsCompiler,
    QueryEngineService
  ],
  exports: [QueryEngineService],
})
export class QueryModule {}
````

## File: src/app.module.ts
````typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import queryConfig from './config/query.config';
import storageConfig from './config/storage.config';
import { MetaModule } from './meta/meta.module';
import { CommonModule } from './common/common.module';
import { QueryModule } from './query/query.module';
import { RepositoryModule } from './repository/repository.module';
import { ServicesModule } from './services/services.module';
import { ReportsController } from './controllers/reports.controller';
import { ReportsService } from './services/reports.service';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { User } from './database/entities/user.entity';
import { Post } from './database/entities/post.entity';
import { Comment } from './database/entities/comment.entity';
import { Role } from './database/entities/role.entity';
import { Permission } from './database/entities/permission.entity';
import { RefreshToken } from './database/entities/refresh-token.entity';
import { ResetPasswordToken } from './database/entities/reset-password-token.entity';
import { File } from './database/entities/file.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, queryConfig, storageConfig],
    }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        entities: [User, Post, Comment, Role, Permission, RefreshToken, ResetPasswordToken, File],
        dbName: configService.get<string>('database.name'),
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        user: configService.get<string>('database.user'),
        password: configService.get<string>('database.password'),
        debug: configService.get<string>('NODE_ENV') !== 'production',
        allowGlobalContext: configService.get<boolean>('database.allowGlobalContext'),
        migrations: {
            path: './src/database/migrations',
            pathTs: './src/database/migrations',
        },
      }),
      inject: [ConfigService],
    }),
    MetaModule,
    CommonModule,
    QueryModule,
    RepositoryModule,
    ServicesModule,
    AuthModule,
    FilesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class AppModule {}
````
