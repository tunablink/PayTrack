# Vận hành local, VPS và dữ liệu

## Local

Yêu cầu Node.js 24 LTS và Python 3.13. Không cần Docker để chạy local.

```powershell
# Tại thư mục gốc; dùng executable Python đã cài thực tế nếu python/py là alias Windows Store.
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock.txt
cd backend
..\.venv\Scripts\python.exe -m app.cli setup
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --ws-max-size 32768
```

Terminal khác:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Mở **http://localhost:3000**. Origin mặc định chính xác là địa chỉ này; nếu dùng 127.0.0.1 hoặc đổi port, đặt APP_ORIGIN cho backend và NEXT_PUBLIC_WS_URL cho frontend tương ứng. `.env.example` gốc là mẫu Compose. CLI/backend đọc biến môi trường của process, không tự nạp tệp .env. Next.js tự đọc `.env.local`; có thể sao chép `frontend/.env.example` thành tệp này.

Trên Linux: `python3 -m venv .venv`, `.venv/bin/python`, `npm`; các lệnh còn lại giống nhau. Chạy CLI và backend từ `backend/` để DATA_DIR mặc định trỏ tới `data/` ở gốc repository. Có thể đặt DATA_DIR là đường dẫn tuyệt đối bên ngoài repository.

Một người có thể đăng ký nhiều tài khoản tại **http://localhost:3000/register** hoặc bấm **Đăng ký tài khoản** trên trang đăng nhập. Mỗi tài khoản cần tên đăng nhập khác nhau, mật khẩu tối thiểu 12 ký tự và xác nhận khớp. Sau khi tạo thành công, bấm **Đăng nhập**. Đăng ký không đóng khi đã có tài khoản. Đơn vị, khoản phải thu và thống kê được tách riêng theo tài khoản; đăng xuất rồi đăng nhập tài khoản khác để chuyển không gian dữ liệu. Giới hạn 10 yêu cầu đăng ký hợp lệ về schema/IP/15 phút để tránh lạm dụng; tên đăng nhập trùng trả lỗi và cho phép sửa tên ngay trong form.

Lệnh `python -m app.cli setup` tạo tài khoản quản trị ban đầu qua terminal bằng getpass, chỉ khi chưa có tài khoản. Tài khoản cũ hoặc tài khoản đầu tiên trên database trống giữ quyền quản trị chức năng sao lưu toàn hệ thống. Các tài khoản đăng ký sau không có quyền backup/status toàn hệ thống và không thấy nút sao lưu. Quyền quản trị không cho phép truy cập đơn vị/khoản thu của tài khoản khác qua API nghiệp vụ.

**Nâng cấp database cũ:** dừng backend rồi chạy lại. Migration 002 tự tạo `DATA_DIR/backups/pre-migration-002-<id>.sqlite3` bằng SQLite backup API trước khi chuyển database phiên bản 1 sang 2. Username, hash mật khẩu, đơn vị, khoản thu, phiên bản bản ghi và session hợp lệ được giữ; dữ liệu cũ thuộc tài khoản ban đầu. Không xóa database để mở đăng ký. Nếu dùng Docker, dựng lại image và recreate backend với nguyên volume dữ liệu.

## Docker local

```bash
cp .env.example .env
docker compose --env-file .env -f deploy/compose.yaml build
docker compose --env-file .env -f deploy/compose.yaml run --rm backend python -m app.cli setup
docker compose --env-file .env -f deploy/compose.yaml up -d
docker compose --env-file .env -f deploy/compose.yaml ps
```

Mở http://localhost (cổng 80). Frontend được build với `/ws`; Nginx chuyển HTTP và WebSocket cùng origin tới backend. Không expose cổng backend/database. Named volume `tracker-data` mount toàn bộ `/data`, gồm SQLite, WAL và backup.

## VPS Linux có domain

1. Chuẩn bị VPS đã có Docker Engine và Compose **>=2.24.4** (`!override` trong HTTPS override). Không tự mua tài nguyên bằng repo này.
2. Trỏ DNS A/AAAA tới VPS, mở 80/443 và cổng SSH cần thiết; chỉ expose reverse proxy.
3. Sao chép source và tạo `.env` riêng với `DOMAIN=tracker.ten-mien-cua-ban`, `APP_ORIGIN=https://tracker.ten-mien-cua-ban`, `COOKIE_SECURE=true`, `SESSION_SECONDS=28800`.
4. Dùng cả hai compose file để thay Nginx bằng Caddy, tự cấp/gia hạn TLS và hỗ trợ WebSocket upgrade:

```bash
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.https.yaml build
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.https.yaml run --rm backend python -m app.cli setup
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.https.yaml up -d
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.https.yaml logs --tail=100
```

Caddy lưu chứng chỉ trong volume riêng. Không bật Secure cookie khi thử HTTP local; phải bật Secure cho HTTPS production. Reverse proxy ghi đè X-Real-IP, backend chỉ tin header đó trong cấu hình secure. Một process backend, không scale replica SQLite và không dùng network filesystem cho thư mục dữ liệu.

## Backup

Giao diện desktop có nút **Sao lưu dữ liệu** bên trái. Tác vụ `backup.start` dùng SQLite backup API trong thread pool; `backup.status` cho biết queued/running/completed/failed. Thành công chỉ khi đã hoàn tất và integrity_check=ok. File ở `DATA_DIR/backups/<job-id>.sqlite3`, không được phục vụ qua URL. Metadata job trong RAM mất khi restart.

CLI local, chạy từ backend:

```bash
python -m app.cli backup --file /duong-dan-rieng/backup-2026-11-02.sqlite3
```

Docker:

```bash
docker compose --env-file .env -f deploy/compose.yaml exec backend python -m app.cli backup --file /data/backups/manual-2026-11-02.sqlite3
docker compose --env-file .env -f deploy/compose.yaml cp backend:/data/backups/manual-2026-11-02.sqlite3 ./backup-2026-11-02.sqlite3
```

Thư mục đích được tạo khi cần; CLI từ chối ghi đè file đã có. Sao lưu cả snapshot nhất quán, không copy riêng `.sqlite3` khi WAL đang hoạt động. Backup chứa dữ liệu và hash mật khẩu/session, nên lưu riêng có quyền chặt chẽ và retention phù hợp. Không commit vào git.

## Restore

1. Dừng backend trước khi phục hồi; giữ một backup mới của dữ liệu hiện tại.
2. CLI kiểm tra integrity của nguồn rồi dùng backup API để restore. Nhập `RESTORE` khi được yêu cầu. Toàn bộ session bị thu hồi.

```bash
# Local (backend/)
python -m app.cli restore --file /duong-dan-rieng/backup-2026-11-02.sqlite3
# Docker, khi file nguồn đã ở volume /data/backups
docker compose --env-file .env -f deploy/compose.yaml stop backend
docker compose --env-file .env -f deploy/compose.yaml run --rm --no-deps backend python -m app.cli restore --file /data/backups/manual-2026-11-02.sqlite3
docker compose --env-file .env -f deploy/compose.yaml up -d backend
```

Đăng nhập lại, kiểm tra số đơn vị, khoản phải thu và tổng trước/sau. Bộ pytest tự thực hiện backup/restore sang SQLite tạm và đối chiếu tổng tiền, đồng thời chạy CLI backup/restore thật qua subprocess. Khi vận hành production vẫn cần diễn tập phục hồi trên bản sao trước.

## Update và kiểm tra persistence

Backup trước, lấy source/lock mới, chạy `docker compose ... up -d --build`. Migration có version `PRAGMA user_version`, áp dụng khi startup, không tự seed. Không dùng `down -v` vì sẽ xóa volume. Sau recreate container: đăng nhập, so sánh tổng Dashboard/Report và kiểm tra health. Các migration sau cần tạo file tuần tự mới và thêm vào MIGRATIONS, không sửa migration đã áp dụng ở production.

Image có restart policy, health check và log rotation 10MB × 3. Đọc `docker compose ... logs backend` để thấy action duration và thread name/ID backup; không có credentials/payload nghiệp vụ trong log ứng dụng. Reverse proxy mặc định không log body/cookie.

## Seed demo và test

Seed chỉ chạy thủ công trên database demo trống:

```bash
# Trong backend; DATA_DIR phải là thư mục demo riêng.
python -m app.cli seed --confirm-empty-demo
```

```powershell
# Backend từ backend/
..\.venv\Scripts\python.exe -m pytest -q
# Frontend từ frontend/
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

Playwright mặc định dùng Chrome đã cài; đổi `E2E_BROWSER_CHANNEL=msedge` nếu dùng Edge. Backend E2E tự tạo database tạm và mật khẩu ngẫu nhiên trong process env, không sửa dữ liệu local. Hai cổng 3000/8000 phải trống. Báo cáo/lỗi test ở frontend/test-results (gitignored); có thể chứa dữ liệu kiểm thử, không phát hành chúng.
