  ---

  Hướng dẫn Hội nhập dành cho Lập trình viên mới

  Chào mừng bạn đến với dự án!

  Bạn đang tham gia vào một dự án có kiến trúc được thiết kế rất cẩn thận để đạt được tốc độ, sự linh hoạt và bảo mật. Việc tuân thủ kiến trúc này không  
  phải là sự gò bó, mà là cách để chúng ta cùng nhau xây dựng các tính năng một cách nhanh chóng và bền vững.

  Hãy đọc kỹ hướng dẫn này, nó sẽ là bản đồ giúp bạn di chuyển một cách tự tin trong codebase.

  Mục tiêu chính của kiến trúc này là gì?

  "Tập trung vào logic nghiệp vụ, không phải code lặp lại."

  Hệ thống đã tự động hóa việc tạo API, truy vấn dữ liệu và kiểm tra quyền. Nhiệm-vụ-của-bạn là xây dựng các tính năng độc đáo mang lại giá trị, không
  phải là viết đi viết lại các endpoint CRUD.

  ---

  Bước 0: Ba Nguyên tắc Vàng (The 3 Golden Rules)

  Trước khi đọc bất kỳ dòng code nào, hãy ghi nhớ BA NGUYÊN TẮC BẤT DI BẤT DỊCH. Vi phạm những nguyên tắc này là cách nhanh nhất để phá hỏng kiến trúc.   

   1. KHÔNG BAO GIỜ TRUY CẬP TRỰC TIẾP DATABASE: Mọi tương tác với dữ liệu PHẢI thông qua GenericRepository hoặc QueryEngine. Không được inject
      EntityManager hay tự viết câu lệnh SQL/ORM trong service của bạn.
   2. KHÔNG BAO GIỜ BỎ QUA KIỂM TRA QUYỀN: Mọi endpoint, mọi service xử lý dữ liệu PHẢI được bảo vệ bởi PermissionService. Không có ngoại lệ, kể cả "chỉ
      là làm tạm".
   3. CONTROLLER CHỈ DÀNH CHO HTTP: Controller là lớp mỏng nhất có thể. Nó chỉ nhận request, gọi một phương thức của service, và trả về kết quả. KHÔNG  
      chứa bất kỳ logic nghiệp vụ, tính toán, hay biến đổi dữ liệu nào.

  Nếu bạn thấy mình sắp vi phạm một trong ba nguyên tắc trên, hãy dừng lại và hỏi một developer senior.

  ---

  Bước 1: Đọc hiểu luồng đi của một Request (Read-Only Path)

  Để hiểu hệ thống, hãy theo dõi hành trình của một request đơn giản. Đây là cách tốt nhất để xây dựng một "mental model" về dự án.

  Nhiệm vụ của bạn: Tìm hiểu xem điều gì xảy ra khi client gọi GET /items/post?sort=-createdAt&limit=10.

   1. Đọc tài liệu kiến trúc: Mở file repomix-output.md (hoặc tài liệu kiến trúc chính thức) và đọc các phần về Query Engine và Generic Items API.        
   2. Theo dõi trong code:
       * Bắt đầu từ src/controllers/items.controller.ts. Bạn sẽ thấy nó nhận request và gọi ItemsService.
       * Đi tới src/services/items.service.ts. Bạn sẽ thấy nó gọi queryEngine.parseAndCompile(req.query). Đây là "phép thuật" xảy ra.
       * Nhìn vào src/query/query-engine.service.ts. Bạn không cần hiểu chi tiết, chỉ cần biết rằng nó nhận req.query và "dịch" nó thành một object       
         FindOptions mà ORM có thể hiểu.
       * Quay lại items.service.ts, bạn sẽ thấy nó gọi repository.find('post', options).
       * Cuối cùng, src/repository/generic.repository.ts là nơi thực sự tương tác với ORM/database.

  Sau khi đi hết luồng này, bạn sẽ hiểu tại sao chúng ta không cần viết controller và service cho mỗi loại dữ liệu.

  ---

  Bước 2: Nhiệm vụ đầu tiên - Thêm một Module CRUD

  Nhiệm vụ đầu tiên của bạn không phải là sửa bug hay làm một tính năng phức tạp. Nhiệm vụ của bạn là thêm một module quản lý mới để thấy được sức mạnh
  của kiến trúc này.

  Yêu cầu: Thêm chức năng quản lý Product (Sản phẩm).

   1. Tạo Entity (`product.entity.ts`):
       * Trong thư mục src/database/entities, tạo một file product.entity.ts.
       * Định nghĩa class Product với các trường như id, name, price, stock. Sử dụng các decorator @Entity(), @Property() của MikroORM.
   2. Đăng ký Entity:
       * Mở file mikro-orm.config.ts.
       * Import Product và thêm nó vào mảng entities.
   3. Tạo Migration:
       * Chạy lệnh npm run migration:create để tạo file migration mới.
       * Chạy lệnh npm run migration:up để cập nhật schema của database.
   4. Kiểm tra "phép thuật":
       * Khởi động server (npm run start:dev).
       * Sử dụng Postman (hoặc curl), gọi GET http://localhost:3000/items/product.
       * Chúc mừng! Bạn vừa có một bộ API CRUD đầy đủ cho Product với khả năng lọc, sắp xếp, phân trang... mà không cần viết một dòng logic nào trong     
         controller hay service.
   5. Thêm Quyền:
       * Vào database, thêm các bản ghi vào bảng permission cho collection product với các action create, read, update, delete.
       * Gán các quyền này cho một vai trò (role) nào đó. Bây giờ, API của bạn đã được bảo vệ.

  Hoàn thành nhiệm vụ này giúp bạn hiểu được 90% "tại sao" dự án được thiết kế như vậy.

  ---

  Bước 3: Xây dựng một Tính năng Tùy chỉnh

  Bây giờ bạn đã sẵn sàng để tạo một tính năng có logic nghiệp vụ riêng.

  Yêu cầu: Tạo một endpoint GET /reports/low-stock để lấy danh sách các sản phẩm sắp hết hàng (tồn kho < 10).

   1. Tạo Controller & Service: Nếu chưa có, tạo reports.controller.ts và reports.service.ts.
   2. Trong `ReportsController`:
       * Thêm một phương thức getLowStockProducts().
       * Gắn decorator @Get('low-stock').
       * Trong thân hàm, chỉ có một dòng: return this.reportsService.getLowStockProducts(req.query);. req.query cho phép người dùng vẫn có thể sort,
         paginate trên kết quả của bạn.
   3. Trong `ReportsService`:
       * Nguyên tắc Vàng #2: Dòng đầu tiên là await this.permissionService.assert('reports', 'read_low_stock');.
       * Tái sử dụng Query Engine:
   1         const options = await this.queryEngine.parseAndCompile({
   2           collection: 'product',
   3           query: query, // query từ controller
   4         });
       * Thêm logic nghiệp vụ:

   1         const lowStockCondition = { stock: { '$lt': 10 } };
   2         options.where = {
   3           $and: [options.where, lowStockCondition],
   4         };
       * Nguyên tắc Vàng #1: Gọi repository: return this.repository.find('product', options);.    

  Bằng cách này, bạn vừa tạo ra một tính năng mới mà vẫn tuân thủ kiến trúc, an toàn và linh hoạt.

  ---

  Tóm tắt: Những điều TUYỆT ĐỐI KHÔNG LÀM

   * KHÔNG inject EntityManager hay MikroORM vào service nghiệp vụ.
   * KHÔNG đặt logic xử lý if/else, tính toán, biến đổi dữ liệu trong Controller.
   * KHÔNG comment out permissionService.assert() để "test cho nhanh".
   * KHÔNG tự viết các câu query phức tạp trong service. Hãy hỏi xem QueryEngine có thể làm điều đó cho bạn không.

  Nếu có bất kỳ nghi ngờ nào, đừng ngần ngại hỏi một thành viên senior trong đội. Thà hỏi một câu còn hơn là đi sai đường và tốn thời gian sửa chữa sau   vậy
  này. Chúc bạn thành công