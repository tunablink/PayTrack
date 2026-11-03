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

