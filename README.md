# PayTrack — Personal Payment Tracking System

Ứng dụng theo dõi khoản phải thu cá nhân: Next.js + TypeScript + Tailwind CSS, Python + FastAPI, WebSocket và SQLite. Một tài khoản chủ sở hữu, không đăng ký công khai. Giao diện tiếng Việt; hai trạng thái Chưa nhận (UNPAID) và Đã nhận (PAID).

Nguồn Stitch được giữ nguyên. Không có README_UPDATED.md trong bộ nguồn ban đầu; README đề xuất cũ được lưu tại [docs/README_ORIGINAL.md](docs/README_ORIGINAL.md). Yêu cầu đính kèm thay thế các đề xuất PostgreSQL/JavaFX và chức năng ngoài phạm vi trong tài liệu cũ.

## Chức năng đã triển khai

- Đăng nhập Argon2id, session cookie HttpOnly, logout, session hết hạn, giới hạn thử đăng nhập; backend bảo vệ Origin/CSRF và từng WebSocket action.
- `/dashboard`: tổng phải thu, đã nhận, chưa nhận, số khoản từng trạng thái; lọc và tổng hợp đơn vị.
- `/organizations`: thêm/xem/sửa/xóa, tên bắt buộc, ghi chú, tìm tên; không xóa đơn vị có khoản phải thu.
- `/payments`: CRUD, thay đổi PAID/UNPAID, tìm nội dung, lọc đơn vị/trạng thái/ngày, phân trang; tính tiền bằng Decimal ở backend.
- `/reports`: đối chiếu theo đơn vị và tháng với cùng công thức và bộ lọc Dashboard.
- WebSocket: correlation ID, timeout, heartbeat, reconnect/backoff, idempotency key riêng, optimistic version; giữ dữ liệu khi offline và khóa ghi.
- SQLite WAL, migration, busy timeout, transaction; sao lưu nhất quán bằng backup API, CLI restore.
- ThreadPoolExecutor chạy backup thật với trạng thái, lỗi, log thread name/ID và shutdown; decorator registry dùng reflection/whitelist và timing log.
- Dockerfiles, Compose, Nginx cùng origin, volume, health check/restart/log rotation; Caddy HTTPS/WSS khi có domain.

## Chạy local và tạo tài khoản

Yêu cầu Node.js 24 LTS và Python 3.13. Tại thư mục gốc trên Windows:

```powershell
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

Mở **http://localhost:3000**. Setup hỏi username và mật khẩu tối thiểu 12 ký tự qua prompt, không có tài khoản mặc định. Không cần seed để sử dụng. Nếu python là alias Windows Store, dùng executable Python thực tế. Ở máy hiện tại: `C:\Users\admin\AppData\Local\Programs\Python\Python313\python.exe`. Linux dùng python3, .venv/bin/python và npm.

## Cấu trúc và dependency

- `frontend/`: App Router, component dùng chung, WebSocket client, Playwright.
- `backend/`: FastAPI, auth, schemas, registry, services, repository, executor, migrations và tests.
- `deploy/`: Dockerfiles, Compose, Nginx và Caddy HTTPS override.
- `docs/`: audit, kiến trúc, vận hành, kết quả test, tiến độ.
- `scripts/audit.cjs`: kiểm kê toàn bộ HTML nguồn.
- `data/`: SQLite local và backups runtime, gitignored.

Dependency khóa tại frontend/package-lock.json và backend/requirements.lock.txt. Database, backup và secrets không được commit.

## Kiểm tra

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
cd ..\frontend
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

Playwright dùng Chrome đã cài, tự khởi động backend với database tạm và frontend production. Build trước, để trống cổng 3000/8000. Kết quả thực tế và giới hạn xác minh: [docs/TESTING.md](docs/TESTING.md).

## Docker và VPS

```bash
cp .env.example .env
docker compose --env-file .env -f deploy/compose.yaml build
docker compose --env-file .env -f deploy/compose.yaml run --rm backend python -m app.cli setup
docker compose --env-file .env -f deploy/compose.yaml up -d
```

Mở http://localhost. Khi có VPS/domain, dùng HTTPS override, đặt APP_ORIGIN đúng domain và COOKIE_SECURE=true. Hướng dẫn chi tiết local/Linux/VPS, backup, restore, update và seed riêng: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Tài liệu và giới hạn

- [Kiểm kê frontend, giữ/chỉnh/loại bỏ](docs/FRONTEND_AUDIT.md)
- [Kiến trúc, hợp đồng WebSocket, session, tiền và ngày](docs/ARCHITECTURE.md)
- [Tiến độ và phần cần xác minh](docs/PROGRESS.md)

WebSocket chạy trên TCP, không phải raw TCP socket. Async/await không đồng nghĩa multithreading. Một backend process và volume trên ổ cục bộ. Chưa triển khai VPS hoặc mua domain. Không tích hợp ngân hàng, thanh toán từng phần, nhiều người dùng hoặc đăng ký công khai.
