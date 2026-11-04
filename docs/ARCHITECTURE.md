# Kiến trúc và hợp đồng

## Thành phần

- Next.js App Router: layout và route là Server Components; workspace, login, form/dialog là Client Components vì cần tương tác. Tailwind build qua PostCSS; CSS chung định nghĩa các thành phần của thiết kế.
- FastAPI: HTTP chỉ dành cho auth/session/logout/health. Nghiệp vụ qua WebSocket `/ws`.
- `schemas.py`: validate theo từng action; cấm field lạ, giới hạn độ dài/giá trị, ngày thực hiện và hai trạng thái.
- `registry.py`: decorator đăng ký whitelist, phát hiện tên trùng, reflection kiểm tra signature `(ctx, payload)`, wrapper ghi thời gian xử lý. Thêm handler bằng decorator không sửa dispatcher.
- `dispatcher.py`: xác thực trên từng thông điệp trong transaction, validation, idempotency và commit trước response.
- `services.py`: quy tắc nghiệp vụ, thống kê dùng chung, tham số hóa truy vấn. `repository.py`: kết nối SQLite độc lập theo tác vụ và migration.
- `executor.py`: ThreadPoolExecutor tối đa 2 worker, tối đa một backup đang hoạt động; trạng thái được bảo vệ bằng Lock, log thread name/ID, shutdown chờ công việc kết thúc.
- SQLite là database duy nhất; PRAGMA foreign_keys bật mỗi connection, WAL, busy_timeout=3000 ms. Một backend process; không mount dữ liệu qua filesystem mạng.
- Migration 002 chuyển `owner` sang `users`, gắn `user_id` vào session, đơn vị, khoản thu và idempotency. Database phiên bản 1 được sao lưu bằng backup API trước migration; tài khoản/dữ liệu/session cũ được giữ nguyên. Foreign key tổng hợp `(organization_id,user_id)` ngăn khoản thu liên kết đơn vị của tài khoản khác.

WebSocket chạy trên TCP, **không phải raw TCP socket**. Async/await không được tính là multithreading. SQL và Argon2 chạy qua AnyIO thread pool có giới hạn mặc định; SQLite backup chạy trong ThreadPoolExecutor riêng. Không khẳng định threading tăng tốc CPU.

## Tin nhắn

```json
{"requestId":"correlation-id","action":"organization.create","payload":{"name":"Đơn vị A","notes":""},"idempotencyKey":"independent-random-write-key"}
```

```json
{"requestId":"correlation-id","success":true,"data":{"id":1,"name":"Đơn vị A","version":1}}
```

```json
{"requestId":"correlation-id","success":false,"error":{"code":"CONFLICT","message":"Dữ liệu đã được thay đổi ở tab khác. Hãy tải lại trước khi sửa."}}
```

Actions: `organization.list/create/update/delete`, `payment.list/create/update/delete/updateStatus`, `dashboard.summary`, `report.summary`, `system.ping`, `backup.start/status`.

- Mỗi thao tác ghi cần `idempotencyKey` riêng (16–100 ký tự), lưu cùng fingerprint action/payload và result trong transaction. Khóa được phân vùng theo user_id, nên hai tài khoản dùng cùng key không đọc kết quả của nhau. Gửi lại key với cùng nội dung trả kết quả đã commit; khác nội dung trong cùng tài khoản trả IDEMPOTENCY_CONFLICT. Cache bền qua restart; không tự xóa, cần tính dung lượng khi sử dụng lâu dài.
- Update/delete/status cần `id`, `version`. `BEGIN IMMEDIATE` và kiểm tra phiên bản ngăn hai tab âm thầm ghi đè. Không tự retry thao tác ghi.
- Frontend timeout 12 giây; pending bị reject và dọn khi disconnect. Nếu thao tác ghi có thể đã commit, thông báo kết quả chưa xác định, giữ dialog và tải lại sau reconnect.
- Heartbeat application-level `system.ping` mỗi 15 giây; browser không gửi raw protocol ping. Reconnect exponential backoff với jitter 0.75–1.25, mức đợi tối đa 30 giây. Sau reconnect luôn lấy snapshot từ backend. Định kỳ 15 giây và khi focus tải lại để phản ánh các tab khác.
- Mất mạng giữ snapshot cũ để xem, disable thao tác ghi. Không có hàng đợi ghi offline.
- Giới hạn thông điệp ứng dụng 32 KiB; Uvicorn production cũng giới hạn frame/message 32 KiB. Request sai JSON/schema/action trả mã lỗi; không trả trace hoặc secrets.
- Origin HTTP POST và WebSocket phải khớp APP_ORIGIN tuyệt đối. Không dùng CORS rộng. Host/proxy production chỉ lộ cổng 80/443.

## Tiền và ngày

- Đơn giá 0–1.000.000.000.000 đồng, số lượng Decimal >0 đến 1.000.000, tối đa 3 chữ số lẻ; thành tiền tối đa 1.000.000.000.000.000 đồng/bản ghi.
- Backend nhân Decimal và ROUND_HALF_UP tới đồng, bỏ qua client amount bằng cách reject field ngoài schema. SQLite lưu giá/amount bằng INTEGER, quantity TEXT giữ Decimal.
- Dashboard và Report gọi cùng hàm tổng hợp trong read transaction. Tổng = paid + unpaid; counts và nhóm theo đơn vị/tháng lấy từ cùng bộ lọc.
- Work date là ISO date không timezone; frontend hiển thị bằng tách chuỗi dd/MM/yyyy. Created/updated lưu UTC và hiển thị Asia/Ho_Chi_Minh. UI vi-VN và VND.
- Backend kiểm tra tổng toàn danh mục không vượt 2^53−1 = 9.007.199.254.740.991 đồng trong cùng write transaction. Giới hạn này bảo vệ độ chính xác của số nguyên JSON/JavaScript và tổng SQLite; thao tác vượt giới hạn bị từ chối trước commit.

## Xác thực

- Hỗ trợ nhiều tài khoản với tên đăng nhập duy nhất. Một người có thể tạo nhiều tài khoản bằng các tên khác nhau; mỗi tài khoản có dữ liệu riêng. Mật khẩu Argon2id, tối thiểu 12 ký tự và xác nhận khớp. Đăng ký không tự tạo phiên; người dùng đăng nhập sau khi lưu thành công.
- POST `/api/auth/register` kiểm tra Origin/CSRF và schema; tên trùng nhận USERNAME_TAKEN (409), giới hạn 10 lần/IP/15 phút nhận RATE_LIMIT (429). Đăng ký luôn mở, GET `/api/auth/registration` trả available=true để tương thích. Unique constraint và transaction bảo vệ khi đăng ký đồng thời; chỉ tài khoản đầu tiên nhận is_admin=1. CLI setup vẫn tạo quản trị viên đầu tiên, không tạo thêm quản trị viên khi đã có tài khoản. Lỗi validation không phản chiếu mật khẩu/request body.
- Dispatcher lấy user_id từ session đã xác thực, không lấy từ payload client. Mọi CRUD, bộ lọc, thống kê và giới hạn tổng tiền áp dụng trong phạm vi user_id; ID của tài khoản khác trả NOT_FOUND hoặc lỗi đơn vị không hợp lệ. Tài khoản quản trị cũng chỉ xem dữ liệu nghiệp vụ của chính mình.
- Session token ngẫu nhiên 48 byte, chỉ lưu SHA-256 digest trong SQLite; cookie HttpOnly, SameSite=Strict, Secure khi COOKIE_SECURE=true. Không URL/localStorage/log credential.
- Thời hạn cứng mặc định 8 giờ, không sliding refresh. Session còn hiệu lực sau backend restart vì lưu trong SQLite. Restore chủ động xóa toàn bộ session.
- Logout xóa session. Khi đăng nhập/chuyển tài khoản, session cookie cũ của trình duyệt bị thu hồi để socket cũ không tiếp tục thao tác. Mỗi WebSocket action đọc lại session trước xử lý; socket idle được kiểm tra ít nhất mỗi 30 giây; phiên bị thu hồi không thực hiện được nghiệp vụ.
- Login giới hạn 5 lần thất bại/IP/15 phút, ghi trong SQLite nên giữ qua restart. Nginx/Caddy ghi đè X-Real-IP; backend không public và chỉ tin header đó khi secure production.
- Backup toàn database chứa dữ liệu nhiều tài khoản nên backup.start/status chỉ cho is_admin=1. Tài khoản ban đầu được chuyển từ owner giữ quyền này; tài khoản đăng ký thêm không thấy nút backup và backend từ chối action. Backup ở thư mục private, không endpoint tải/static URL. Trạng thái job là in-memory, mất khi restart; tệp backup vẫn còn. CLI backup/restore dành cho người quản trị máy chủ.

## Tham chiếu chính thức đã dùng

- [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation)
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
