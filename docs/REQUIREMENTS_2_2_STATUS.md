# 2.2 Yêu cầu chức năng - đối chiếu với source code

Cập nhật: 2026-02-23
Phạm vi đối chiếu: source code hiện có trong repo `nestjs-base-be`.

Quy ước:
- `x`: Đã có trong source code.
- `~`: Mới có một phần, cần bổ sung thêm để đúng như yêu cầu.
- `` (trong cột Có): Chưa thấy trong source code hiện tại.

## I. Chức năng dành cho người dùng

| Stt | Nhóm chức năng/chức năng | Có | Trạng thái code | Ghi chú |
|---|---|---|---|---|
| 1 | Gửi/nhận thư điện tử (trong và ngoài cơ quan) | x | Đã có | Có API gửi mail (`POST /webmail/mail/send`) và API đọc/list mail (`GET /webmail/mail`, `GET /webmail/mail/:id`). |
| 2 | Gửi/nhận kèm tệp (file Word, Excel, ảnh, PDF...) | x | Đã có | `SendMailDto.attachments` + xử lý attachment trong SMTP/IMAP; có module file upload/stream. |
| 3 | Lưu thư nháp để gửi sau. | ~ | Một phần | Có folder `Drafts` để đọc/list; chưa thấy API tạo/lưu draft riêng trước khi gửi. |
| 4 | Chuyển tiếp hoặc trả lời thư | ~ | Một phần | Có API gửi mail tổng quát; có field `replyTo`; chưa có endpoint `reply/forward` chuyên biệt. |
| 5 | Đánh dấu thư quan trọng, lọc thư chưa đọc. | ~ | Một phần | Có folder `Starred` (flagged) và API mark read/unread; chưa có API bật/tắt `star` và query filter unread riêng. |
| 6 | Sắp xếp thư vào các thư mục riêng. | x | Đã có | Có API move 1 mail và move batch (`/webmail/mail/move`, `/webmail/mail/move-batch`). |
| 7 | Tìm kiếm và lọc thư | ~ | Một phần | Có API search (`/webmail/mail/search`); chưa có bộ filter đầy đủ theo nhiều điều kiện. |
| 8 | Tìm thư theo người gửi, tiêu đề, nội dung, ngày tháng. | ~ | Một phần | Search hiện tại theo `from/subject/body`; chưa thấy filter theo ngày tháng. |
| 9 | Lọc thư có file đính kèm hoặc theo trạng thái (đã đọc/chưa đọc/...) |  | Chưa có | API list trả về `hasAttachments`, `isRead` nhưng chưa có filter query theo các trạng thái này. |
| 10 | Hộp thư đến (Inbox) | x | Đã có | Có mapping folder `INBOX` và API list folder/mail. |
| 11 | Hộp thư đi (Outbox) |  | Chưa có | Chưa thấy folder/API outbox riêng. |
| 12 | Thư đã gửi (Sent Items) | x | Đã có | Có folder `Sent Items`; mail gửi xong được append vào Sent. |
| 13 | Thư nháp (Drafts) | ~ | Một phần | Có folder `Drafts` để truy xuất; chưa có luồng tạo draft riêng. |
| 14 | Thư đã xóa (Deleted Items) | x | Đã có | Có mapping `Trash` alias `Deleted Items`; có move vào trash và permanent delete. |
| 15 | Thư rác (Junk Email) | x | Đã có | Có mapping folder `Spam` alias `Junk Email`. |
| 16 | Nguồn tin RSS (RSS Feeds): Nhận tin tức tự động từ các trang web đăng ký. |  | Chưa có | Chưa thấy module/API RSS. |
| 17 | Lịch làm việc và nhắc việc |  | Chưa có | Chưa thấy module/API calendar/reminder. |
| 18 | Tạo lịch làm việc |  | Chưa có | Chưa thấy API tạo sự kiện lịch. |
| 19 | Hẹn giờ, đặt lời nhắc |  | Chưa có | Chưa thấy API reminder/alarm. |
| 20 | Lặp lại lịch theo ngày, tuần, tháng. |  | Chưa có | Chưa thấy recurrence rule cho lịch. |
| 21 | Quản lý danh bạ |  | Chưa có | Chưa thấy module/API contacts. |
| 22 | Tra cứu danh bạ |  | Chưa có | Chưa thấy API tìm kiếm danh bạ. |
| 23 | Ghi chú và sổ tay |  | Chưa có | Chưa thấy module/API notes. |
| 24 | Sử dụng trên máy tính, điện thoại, hoặc qua trình duyệt web. | ~ | Một phần | Backend REST API có thể dùng cho web/mobile; repo hiện tại không chứa client desktop/mobile/webmail UI đầy đủ. |
| 25 | Đồng bộ dữ liệu giữa các thiết bị. | ~ | Một phần | Dữ liệu mail đồng bộ theo Exchange/IMAP; chưa có cơ chế đồng bộ thiết bị riêng ở backend này. |

## II. Chức năng dành cho quản trị

### Quản lý tài khoản

| Stt | Nhóm chức năng/chức năng | Có | Trạng thái code | Ghi chú |
|---|---|---|---|---|
| 26 | Tạo tài khoản email | ~ | Một phần | Có tạo bản ghi `User` nội bộ khi login Exchange lần đầu; chưa có API/provisioning tạo mailbox email quản trị. |
| 27 | Xóa hoặc tạm khóa tài khoản |  | Chưa có | Chưa thấy API disable/delete account. |
| 28 | Quản lý hộp thư dùng chung cho nhóm hoặc phòng ban. |  | Chưa có | Chưa thấy shared mailbox management. |
| 29 | Cài đặt giới hạn dung lượng hộp thư. |  | Chưa có | Chưa thấy quota setting APIs. |

### Bảo mật và lọc thư

| Stt | Nhóm chức năng/chức năng | Có | Trạng thái code | Ghi chú |
|---|---|---|---|---|
| 30 | Ngăn thư rác (spam) và thư chứa mã độc | ~ | Một phần | Có folder Spam/Junk để xử lý ở mức mailbox; chưa thấy engine/rule lọc spam-malware tại backend này. |
| 31 | Đặt quy tắc để tự động xử lý hoặc chặn thư theo điều kiện. |  | Chưa có | Chưa thấy message rules/filter rules APIs. |

### Theo dõi và báo cáo

| Stt | Nhóm chức năng/chức năng | Có | Trạng thái code | Ghi chú |
|---|---|---|---|---|
| 32 | Xem thống kê số lượng thư gửi/nhận | ~ | Một phần | Có `GET /webmail/folders/counts` (total/unread theo folder); chưa có báo cáo gửi/nhận theo kỳ. |
| 33 | Xem lịch sử đăng nhập, gửi nhận | ~ | Một phần | Có audit interceptor ghi CUD vào DB; chưa thấy API UI quản trị để xem lịch sử đăng nhập/gửi-nhận đầy đủ. |
| 34 | Cảnh báo khi dung lượng hộp thư hoặc máy chủ sắp đầy |  | Chưa có | Chưa thấy cảnh báo quota/server capacity. |

### Sao lưu và phục hồi

| Stt | Nhóm chức năng/chức năng | Có | Trạng thái code | Ghi chú |
|---|---|---|---|---|
| 35 | Sao lưu toàn bộ dữ liệu email. |  | Chưa có | Chưa thấy backup service/API. |
| 36 | Khôi phục từng thư hoặc cả hộp thư khi cần. |  | Chưa có | Chưa thấy restore mail/mailbox APIs. |

## Bằng chứng source code chính

- Mail APIs: `src/exchange/controllers/exchange.controller.ts`
- Mail business logic: `src/exchange/services/mail.service.ts`
- IMAP/SMTP provider: `src/exchange/services/imap-mail.provider.ts`
- Folder mapping (Inbox/Sent/Drafts/Spam/Trash/Starred): `src/exchange/constants/mail-folders.constant.ts`
- Exchange auth + khởi tạo folder mailbox: `src/exchange/services/exchange-auth.service.ts`
- Audit interceptor/service: `src/audit/audit-log.interceptor.ts`, `src/audit/audit.service.ts`
- File upload/asset APIs: `src/files/files.controller.ts`, `src/files/files.service.ts`
