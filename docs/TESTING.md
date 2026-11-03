# Kết quả kiểm tra thực tế — 02/11/2026

Môi trường: Windows, Node.js 24.15.0, npm 11.12.1, Python 3.13.7, Chrome đã cài trên máy; Next.js 16.4.4/React 19.3.1. Backend và E2E dùng database tạm riêng; không tạo tài khoản mặc định hoặc ghi dữ liệu mẫu vào database sử dụng thực tế.

## Đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Backend `python -m pytest -q` | **25 passed**; 6 cảnh báo deprecation từ TestClient/httpx và Uvicorn/websockets legacy, không có test lỗi |
| Frontend `npm run lint` | Đạt, 0 error / 0 warning ở lượt kiểm tra sau sửa |
| Frontend `npm run typecheck` | Đạt |
| Frontend `npm run build` | Đạt; sinh đủ route /login, /dashboard, /organizations, /payments, /reports |
| Chrome Playwright desktop 1280×720 và mobile 390×664 (CSS viewport iPhone 13 emulation) | 4/4 kiểm thử đã đạt; mobile là Chromium emulation, không phải Safari trên thiết bị thật |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit` gồm development dependencies | 16 moderate trong chuỗi ESLint/minimatch; không có high/critical. Không áp dụng gợi ý downgrade phá vỡ tương thích từ audit |
| Compose HTTP `docker --config deploy compose --env-file .env.example -f deploy/compose.yaml config --quiet` | Đạt |
| Compose HTTPS override, đặt DOMAIN mẫu rồi `config --quiet` với cả hai file | Đạt |

## Nội dung backend

- Auth, cookie session, Origin HTTP/WebSocket, CSRF, rate limit, logout trên socket đang mở, session hết hạn và giữ session qua app restart.
- CRUD đơn vị/khoản thu, trim tên, validate dữ liệu, tính 20×200.000=4.000.000, làm tròn 1.005×100=101 đồng, reject field amount và trạng thái ngoài PAID/UNPAID.
- Không xóa đơn vị còn khoản thu ở cả service và SQLite FK.
- Tổng phải thu = đã nhận + chưa nhận, Dashboard/Report thống nhất, nhóm đơn vị/tháng, search/filter/pagination.
- Idempotency cùng key/cùng payload không ghi trùng; key khác nội dung bị từ chối; hai writer cạnh tranh chỉ một version update thành công; SQLite busy trả lỗi có kiểm soát.
- WebSocket JSON lỗi, schema lỗi, unknown action, nhiều client, reconnect với requestId khớp response; test riêng dùng Uvicorn thực và `websockets.sync` qua TCP loopback.
- Registry phản xạ signature, tên trùng, handler mới và whitelist.
- Backup trong thread pool, log thread name/ID; ping vẫn được xử lý khi worker backup đang chờ I/O; mô phỏng lỗi ổ đĩa, kiểm tra trạng thái FAILED và shutdown.
- Backup/restore API sang DB tạm, integrity_check và đối chiếu tiền; chạy thật CLI backup/restore qua subprocess, restore thu hồi session.
- Tổng danh mục bị giới hạn ở số nguyên an toàn JSON/JavaScript; kiểm thử 9 khoản × 10^15 đồng và từ chối khoản thứ 10 trước commit.

## Nội dung trình duyệt

Đăng nhập, điều hướng, thêm đơn vị, hủy/ESC và bỏ thay đổi chưa lưu, thêm/xem/sửa/xóa khoản phải thu, đổi Đã nhận/Chưa nhận hai chiều, đối chiếu báo cáo, lọc đơn vị/trạng thái/ngày, chặn xóa đơn vị đang có khoản thu, sửa ghi chú, xóa đơn vị sau khi đã xóa khoản thu, tìm kiếm/empty state, reset filter, offline giữ snapshot/khóa ghi, online reconnect và snapshot mới, backup trên cả desktop/mobile, logout. Lượt cuối: **4 passed (52.4s)**.

Test mô phỏng **commit thành công nhưng response bị mất** bằng Playwright WebSocket routing. Sau timeout, UI phải báo “Kết quả lưu chưa xác định”, không báo “Đã lưu thay đổi”; sau reconnect chỉ có đúng một dòng đã commit.

Đã chụp và xem trực tiếp PNG của bảng khoản thu và báo cáo trên desktop/mobile. Kiểm tra chiều rộng trang không vượt viewport; bảng rộng cuộn trong vùng bảng. Nội dung công việc/ghi chú dài được thử trong form và bảng. Không có lỗi JavaScript `pageerror` trong luồng nghiệp vụ chính.

Ảnh runtime ở `docs/screenshots/` (gitignored, có thể tạo lại bằng test): payments-desktop.png, payments-mobile.png, reports-desktop.png, reports-mobile.png. Đây là dữ liệu kiểm thử ghi vào backend thật, không phải dữ liệu mock trên màn hình sản phẩm.

## Lỗi đã phát hiện và sửa trong quá trình kiểm tra

- Lỗi nằm sau modal: thêm thông báo lỗi ngay bên trong dialog.
- Label bọc select/textarea có nội dung làm truy vấn/nhãn không ổn định: chuyển thành label htmlFor + id riêng bằng React useId.
- Chuyển offline nhưng WebSocket cũ còn OPEN: xử lý sự kiện online/offline, reject pending, bỏ socket cũ và khóa ghi ngay.
- Nút backup bị ẩn ở mobile: đưa thao tác vào header khi sidebar thu gọn.
- Tailwind utility hidden bị CSS component override: dùng quy tắc responsive rõ ràng cho nút backup.
- Cấu hình test sinh lại mật khẩu khi worker nạp config: tái sử dụng mật khẩu ngẫu nhiên của cùng test run qua process env.
- Runner Playwright tự dọn server trên Windows không ổn định: dùng wrapper quản lý trực tiếp các child process do test tạo và dừng chúng khi kết thúc.

## Chưa được xác minh

- Docker Engine daemon không chạy (`npipe docker_engine` không tồn tại); vì vậy **chưa build/chạy image Linux**, chưa kiểm tra volume sau recreate container. Chỉ kiểm tra cú pháp Compose thành công.
- Chưa có VPS/domain; chưa kiểm thử chứng chỉ TLS/WSS, proxy upgrade trong container thực hay firewall production.
- Chưa thử Safari/iOS hoặc Android trên thiết bị thật; mobile hiện là Chrome emulation.
- Chưa benchmark tải lớn hoặc tốc độ multithreading; không đưa số liệu hiệu năng suy đoán.

Lệnh kiểm tra lại Docker sau khi daemon hoạt động:

```bash
docker compose --env-file .env -f deploy/compose.yaml build
docker compose --env-file .env -f deploy/compose.yaml run --rm backend python -m app.cli setup
docker compose --env-file .env -f deploy/compose.yaml up -d
docker compose --env-file .env -f deploy/compose.yaml ps
# Ghi một đơn vị và khoản phải thu, sau đó recreate và kiểm tra lại dữ liệu:
docker compose --env-file .env -f deploy/compose.yaml up -d --force-recreate
```

Xem OPERATIONS.md cho HTTPS override, backup/restore và update. Không dùng down -v trong quy trình kiểm tra persistence.
