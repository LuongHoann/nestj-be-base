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