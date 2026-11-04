# Tiến độ — 02/11/2026

## Đã hoàn thành và kiểm tra tại local

- Đọc README.md (README_UPDATED.md không có trong nguồn), toàn bộ HTML/scripts/thiết kế và kiểm kê 4 HTML, 4 PNG, 1 Markdown. Giữ nguyên thư mục Stitch; lưu README cũ trong docs/README_ORIGINAL.md.
- Next.js App Router/TypeScript/Tailwind: login, dashboard, organizations, payments, reports; component shell/button/field/dialog/table/badge/error/empty/connection; font tự host và Lucide.
- Backend FastAPI/SQLite: schema/registry/dispatcher/services/repository/auth/config/executor; migration, WAL/FK/timeout, session bền qua restart, CSRF/Origin/rate limit.
- CRUD, lọc/tìm/phân trang, hai trạng thái, thống kê thống nhất, Decimal HALF_UP, giới hạn tổng tiền an toàn, idempotency/version và xử lý kết quả chưa xác định.
- Backup API/thread pool/status/private storage; CLI setup/backup/restore/seed; restore thu hồi session.
- 25/25 backend tests đạt; lint/typecheck/production build đạt; 4/4 Playwright desktop/mobile đạt ở lượt cuối với xem/sửa/xóa, trạng thái, bộ lọc, offline/reconnect, backup và mất response sau commit.
- Đã xem ảnh runtime desktop/mobile; kiểm tra không tràn ngang toàn trang. Test data chỉ nằm trong DB tạm. Các child process test đã dừng sau khi chạy.
- Dockerfiles, Compose HTTP/HTTPS, persistent volume, proxy và hướng dẫn vận hành; hai cấu hình Compose qua config validation.
- README, audit, architecture, operations, testing được cập nhật theo kết quả thực.

## Phần còn cần môi trường triển khai

- Docker daemon chưa chạy: chưa build/chạy image, chưa xác minh recreate container giữ dữ liệu qua volume.
- Chưa có VPS/domain: chưa chạy TLS/WSS và proxy trên VPS thực.
- Mobile dùng Chrome emulation; chưa thử thiết bị Safari/iOS/Android thật.
- Development dependency audit còn 16 moderate trong ESLint/minimatch; production audit 0 vulnerabilities.

Xem TESTING.md và OPERATIONS.md để chạy lại các bước chưa xác minh. Không có VPS/domain hoặc tài nguyên public được tạo.

## Cập nhật 03/11/2026

- Đổi font toàn bộ giao diện từ Be Vietnam Pro sang Inter theo yêu cầu; giữ độ đậm 400/500/600/700, tự host bằng @fontsource/inter 5.3.0; cập nhật package-lock.json.


- Cập nhật /payments: chuyển thao tác Đã nhận sang checkbox ở cột đầu bên trái; tick/bỏ tick giữ xác nhận, kiểm tra kết nối và chỉ đổi trạng thái sau backend commit. Cập nhật Playwright kiểm tra hủy xác nhận và đổi trạng thái hai chiều.


- Sửa header: tách WorkspaceHeader và CSS Module riêng để style đi cùng component; avatar/tên/vai trò/đăng xuất đúng bố cục. Playwright kiểm tra cô lập trên dev server đạt 2/2 desktop/mobile, gồm tên dài; không truy cập hoặc sửa dữ liệu thật.


## Cập nhật 04/11/2026 — Đăng ký chủ sở hữu đầu tiên

- Thêm /register và link đăng ký ở /login chỉ khi chưa có owner.
- Form: tên đăng nhập, mật khẩu ít nhất 12 ký tự, xác nhận mật khẩu; báo lỗi và khóa gửi khi đang xử lý. Sau lưu thành công, người dùng chuyển về đăng nhập.
- API GET /api/auth/registration và POST /api/auth/register; kiểm tra Origin, schema, Argon2 và transaction bảo vệ chỉ một owner. Đóng đăng ký khi owner đã tồn tại, kể cả owner tạo qua CLI. Không sửa database hay tài khoản thật trong kiểm thử.
- 34/34 backend tests đạt (bao gồm đăng ký, xác nhận, hashing, CSRF, cạnh tranh và đăng nhập sau đăng ký).
- 4/4 Playwright đăng ký desktop/mobile đạt (22.6 giây); đây là test UI cô lập có mock auth endpoints, còn API thật được kiểm tra riêng trong pytest bằng DB tạm.
- Production build đạt, có route /register; đã xem ảnh form desktop/mobile. README, OPERATIONS và ARCHITECTURE được cập nhật.

## Cập nhật 04/11/2026 — Nhiều tài khoản

- Theo yêu cầu mới, bỏ giới hạn một owner: /register luôn cho tạo tài khoản với username khác nhau, mật khẩu và confirm password. Tên trùng trả USERNAME_TAKEN và giữ form để sửa; có giới hạn 10 yêu cầu đăng ký/IP/15 phút.
- Migration 002 tạo users, gắn user_id vào session/đơn vị/khoản thu/idempotency; tài khoản và dữ liệu cũ được chuyển cho user ban đầu, có bản backup SQLite trước migration database phiên bản 1.
- Backend giới hạn toàn bộ CRUD/filter/search/pagination/summary/idempotency theo session user_id; FK tổng hợp chặn liên kết khoản thu sang đơn vị tài khoản khác. Chuyển tài khoản thu hồi session cũ của trình duyệt.
- Backup toàn database chỉ dành cho quản trị viên ban đầu, cả UI và backend đều kiểm tra quyền; CLI backup/restore dành cho người vận hành máy chủ.
- Backend 38/38 đạt, bao gồm migration dữ liệu/session cũ, nhiều tài khoản, truy cập chéo ID, idempotency riêng và race/duplicate/rate limit. Typecheck/lint/build đã đạt. Sáu bài UI header/registration desktop/mobile đã đạt trên dev server với endpoints cô lập.
- Đã bổ sung E2E thật đăng ký A/B, tạo khoản thu A, kiểm tra B không có dữ liệu A, quay lại A còn nguyên dữ liệu; sử dụng backend tạm để không ghi database thật khi cổng dev đang sử dụng.

- Kết quả cuối nhiều tài khoản: 38 backend tests, typecheck/lint/build đạt; 6 UI header/registration desktop/mobile đạt; 2 E2E thật A/B qua backend SQLite tạm đạt (46.7 giây). Backend tạm cổng 18100 đã dừng, server dev của người dùng được giữ nguyên.

## Cập nhật 04/11/2026 — Biểu đồ trang Báo cáo

- Thêm ReportCharts vào /reports phía trên các bảng đối chiếu: cột Đã nhận/Chưa nhận theo tháng hoặc quý, đường tổng tùy chọn, donut tỷ trọng theo giá trị và thanh ngang chưa nhận theo đơn vị.
- Dùng duy nhất summary từ WebSocket report.summary, chịu cùng bộ lọc và phạm vi tài khoản với bảng. Không thêm trạng thái quá hạn/pending hoặc số liệu tăng trưởng viết cố định.
- SVG/CSS Module, không thêm dependency; hỗ trợ focus bàn phím, đọc số tiền từng kỳ, tên biểu đồ truy cập và cuộn ngang trên màn hình nhỏ.
- 4/4 Playwright desktop/mobile đạt (17.6s), kiểm tra gộp quý, tỷ lệ, thứ hạng, bộ lọc, empty state và khoản 0 đồng; dữ liệu mẫu chỉ nằm trong test fixture, không sửa database thật. Đã xem ảnh runtime desktop/mobile.
- Production build, lint và typecheck cuối đều đạt.

## Cập nhật trang Đơn vị — 04/11/2026

- Chỉ mở rộng thông tin đơn vị và các phần phụ thuộc trực tiếp: bảng có đúng thứ tự Tên tổ chức / Loại hình / Người đại diện / Thông tin liên hệ / Địa chỉ / Ghi chú / Trạng thái / Thao tác. Giữ bố cục, font và bảng màu hiện tại; CSS mới chỉ áp dụng cho bảng đơn vị.
- Form thêm/sửa và chi tiết bổ sung loại hình, người đại diện, email, số điện thoại, địa chỉ, trạng thái ACTIVE/INACTIVE. Email/điện thoại có liên kết mailto/tel; trạng thái hiển thị Đang hoạt động/Ngừng hoạt động.
- Migration 003 thêm cột có mặc định an toàn, không đổi tên/ghi chú/version/quyền sở hữu hoặc các khoản thu cũ. Backend validate độ dài/email/điện thoại/trạng thái, lưu và trả các trường mới qua các action đơn vị hiện có.
- Truy vấn thống kê chỉ được bổ sung tiền tố p.status/p.amount để tránh trùng tên khi bảng đơn vị cũng có status; giữ nguyên công thức và hành vi các trang khác.
- 50/50 backend tests đạt; 2/2 UI tests desktop/mobile đạt cho thứ tự cột, thêm/sửa/xem, xóa thông tin liên hệ và tải lại; UI fixtures riêng, DB tạm cho backend. Typecheck/lint/production build đạt. Ảnh bảng thực tế đã được xem; không thay đổi giao diện Báo cáo/Khoản phải thu/Header.

## Cập nhật bộ lọc và chỉ số Báo cáo — 04/11/2026

- Trang Báo cáo bỏ bộ lọc đơn vị/trạng thái/từ ngày/đến ngày/đặt lại. Thay ba ô cũ bằng Tổng doanh thu hợp đồng / Tổng khoản thu đã nhận / Dư nợ / Tỷ lệ thu hồi công nợ (đã nhận chia tổng, 0% khi tổng bằng 0).
- Bộ lọc Năm / Đối tác / Khoảng thời gian đặt dưới bốn chỉ số. Cả năm và Theo quý lấy toàn năm đã chọn; Theo quý đồng bộ biểu đồ gộp quý. Sáu tháng gần nhất lấy sáu tháng tới ngày hiện tại cho năm hiện tại; năm khác lấy tháng 7–12. Khoảng ngày thực tế hiển thị dưới bộ lọc.
- Nút Xuất báo cáo ở đầu trang tải CSV UTF-8 có BOM cho Excel, chứa chỉ số và đối chiếu theo đối tác/tháng hoặc quý của bộ lọc hiện tại; khóa khi đang tải hoặc bộ lọc chưa khớp dữ liệu đã tải.
- Action chỉ đọc report.years lấy các năm có khoản thu theo tài khoản đăng nhập. Không đổi schema hay dữ liệu đã lưu; giữ nguyên các bảng và thiết kế biểu đồ hiện có, các trang khác dùng bộ lọc/chỉ số cũ.
- 51/51 backend tests đạt, gồm các năm phân biệt/sắp xếp và cách ly tài khoản. Typecheck/lint/production build đạt; 8/8 Playwright desktop/mobile đạt cho bộ lọc, nhóm quý, xuất CSV, dữ liệu rỗng, tổng 0 và khoảng sáu tháng qua năm mới. UI dùng fixtures riêng; backend dùng DB tạm.
