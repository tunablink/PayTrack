# Triển khai PayTrack: Vercel + Render + SQLite

Frontend Next.js trên Vercel; FastAPI/WebSocket trên Render; SQLite trên Persistent Disk. Không cần VPS hoặc tên miền riêng. Các địa chỉ dưới đây là ví dụ: thay bằng URL thực tế được hai nền tảng cấp.

## 1. Đưa code lên GitHub

Tạo repository riêng tư và đưa source mới nhất lên đó. Nếu repository local chưa có remote:

```powershell
cd "C:\Homework\JSD\New\New folder"
git status
git add .
git commit -m "Prepare PayTrack for Vercel and Render"
git remote add origin https://github.com/TEN_GITHUB/TEN_REPOSITORY.git
git push -u origin HEAD
```

Nếu đã có remote, bỏ lệnh `git remote add origin` và push lên branch đang sử dụng. Giữ `.gitignore` và `.dockerignore`: không đưa `.env`, database, backup, `.venv`, `node_modules` hoặc `.next` lên GitHub. Không tạo repository public để chứa bản backup SQLite.

## 2. Tạo backend trên Render

Render Dashboard → New → Web Service → kết nối repository.

| Trường | Giá trị |
| --- | --- |
| Name | `paytrack-api` hoặc tên còn trống |
| Language / Runtime | Docker |
| Branch | Branch đã push ở bước 1 |
| Root Directory | Để trống: dùng gốc repository |
| Dockerfile Path | `./deploy/render.Dockerfile` |
| Docker Build Context | `.` nếu giao diện có trường này |
| Docker Command | Để trống: image đã có lệnh khởi động |
| Health Check Path | `/api/health` |
| Instances | 1 |
| Instance type | Gói trả phí có hỗ trợ Persistent Disk |

Thêm Persistent Disk trước khi dùng dữ liệu thật:

| Trường | Giá trị |
| --- | --- |
| Mount Path | `/var/data` |
| Size | 1 GB hoặc mức tối thiểu phù hợp mà giao diện cho chọn |

Render chỉ lưu bền vững những file nằm trong đường dẫn disk. Database là `/var/data/tracker.sqlite3`; backup nằm trong `/var/data/backups`. Không cần tạo Render Postgres.

Thêm Environment Variables:

```env
DATA_DIR=/var/data
APP_ORIGIN=https://your-project.vercel.app
COOKIE_SECURE=true
WS_TICKET_AUTH=true
SESSION_SECONDS=28800
```

`APP_ORIGIN` tạm thời là địa chỉ ví dụ; cập nhật URL thật ở bước 4. Không cần tự đặt `PORT`: entrypoint đọc cổng Render cấp. Docker image chạy một Uvicorn worker và migration tự động khi khởi động.

Tạo dịch vụ, đợi Live rồi mở `https://TEN_BACKEND.onrender.com/api/health`. Phải nhận `{"status":"ok"}`. Đường dẫn `/` không có trang giao diện nên trả 404 là bình thường.

## 3. Tạo frontend trên Vercel

Vercel Dashboard → Add New → Project → Import cùng repository.

| Trường | Giá trị |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `frontend` |
| Node.js Version | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Giữ mặc định của Next.js |

Thêm Environment Variables cho Production, dùng URL backend thật ở bước 2:

```env
BACKEND_URL=https://TEN_BACKEND.onrender.com
NEXT_PUBLIC_WS_URL=wss://TEN_BACKEND.onrender.com/ws
NEXT_PUBLIC_WS_TICKET_AUTH=true
```

`BACKEND_URL` không có `/api` ở cuối. `NEXT_PUBLIC_WS_URL` kết thúc bằng `/ws`. Các biến `NEXT_PUBLIC_` được đưa vào bundle khi build, nên đổi biến xong phải Redeploy. Không dùng `localhost`, `127.0.0.1` hoặc URL ví dụ trên bản online.

Deploy và lấy URL Production cố định trong Domains, ví dụ `https://paytrack-demo.vercel.app`. Dùng URL Production cố định, không dùng URL Preview theo từng commit.

## 4. Ghép hai dịch vụ

Quay lại Render → Environment:

```env
APP_ORIGIN=https://paytrack-demo.vercel.app
```

Thay bằng URL Production thật, không có dấu `/` ở cuối. Save và để Render khởi động lại. Nếu sau này thay domain frontend, cập nhật lại `APP_ORIGIN`.

API `/api/*` được Next.js proxy đến Render; cookie HttpOnly thuộc frontend. Trình duyệt lấy vé WebSocket qua `POST /api/auth/ws-ticket`, rồi gửi vé trong WebSocket subprotocol tới Render. Vé dùng một lần và hết hạn sau 30 giây, không cần cookie bên thứ ba hoặc CORS wildcard. Mỗi lần reconnect lấy vé mới. Backend vẫn kiểm tra session với từng thao tác, nên đăng xuất thu hồi quyền của socket đang mở. Không ghi vé hoặc cookie vào URL/log.

## 5. Giữ tài khoản và dữ liệu SQLite hiện tại

Nếu muốn giữ tài khoản `tuna` và dữ liệu mẫu, dùng cách nhập một lần dưới đây. Nếu muốn database mới, bỏ bước này rồi đăng ký tại URL Vercel; tài khoản đầu tiên có quyền quản trị backup.

### 5.1 Tạo bản sao trên Windows

Trong PowerShell, chạy từ thư mục backend:

```powershell
cd "C:\Homework\JSD\New\New folder\backend"
..\.venv\Scripts\python.exe -m app.cli backup --file "..\data\paytrack-deploy.sqlite3"
```

CLI không ghi đè file đã tồn tại. Nếu đã có file này, dùng tên khác và thay tên tương ứng ở các bước tiếp theo. Dùng backup API của dự án, không copy riêng file SQLite đang mở.

### 5.2 Chuyển file qua Magic Wormhole

Có thể dùng SCP theo hướng dẫn Connect của Render, hoặc dùng Magic Wormhole trong Render Shell. File chuyển trực tiếp vào Persistent Disk, không qua GitHub.

Trên PowerShell của máy bạn:

```powershell
cd "C:\Homework\JSD\New\New folder"
.\.venv\Scripts\python.exe -m pip install magic-wormhole
.\.venv\Scripts\wormhole.exe send .\data\paytrack-deploy.sqlite3
```

Giữ terminal này mở và lấy mã chuyển file được in ra. Không đưa mã vào source hoặc chia sẻ công khai.

Render → dịch vụ backend → Shell:

```bash
python -m pip install magic-wormhole
cd /var/data
wormhole receive
```

Nhập mã từ máy bạn và chấp nhận nhận file. Kiểm tra file đã nằm tại `/var/data/paytrack-deploy.sqlite3`.

### 5.3 Nhập trước khi backend khởi động

Thêm biến Render:

```env
IMPORT_DATABASE_ONCE=/var/data/paytrack-deploy.sqlite3
```

Save và restart/redeploy backend. Entrypoint chạy trước Uvicorn: kiểm tra file, backup database đích vào `/var/data/backups/pre-render-import-*.sqlite3`, phục hồi, thu hồi session cũ, áp dụng migration rồi đổi tên nguồn thành `paytrack-deploy.sqlite3.imported`. Log thành công: `SQLite import completed; old sessions revoked.`

Không chạy restore thủ công khi backend đang phục vụ request. Cơ chế nhập ở entrypoint tránh việc này. File nguồn được đổi tên nên restart sau không nhập lại và không ghi đè các thay đổi mới. Sau khi xác nhận thành công, xóa biến `IMPORT_DATABASE_ONCE` khỏi Render cho gọn.

Đăng nhập ở Vercel bằng username/mật khẩu cũ. Bản local được giữ nguyên. Không đăng ký hoặc nhập dữ liệu thật trên Render trước khi phục hồi, trừ khi chủ động chấp nhận thay database đích bằng bản local.

## 6. Kiểm tra sau triển khai

1. Mở `/api/health` ở Render và `/api/health` ở Vercel, cả hai phải trả status ok.
2. Đăng nhập trên Vercel; mở Tổng quan, Đơn vị, Quản lí khoản thu, Báo cáo.
3. Trong Network: `/api/auth/ws-ticket` trả 200; WebSocket `/ws` trên Render upgrade 101 và có message phản hồi.
4. Tạo/sửa một khoản thu, tick đã nhận, tải lại trang và kiểm tra kết quả.
5. Đăng xuất rồi đăng nhập lại; dữ liệu vẫn đúng tài khoản.
6. Restart Render, đăng nhập lại và xác nhận bản ghi đã tạo vẫn còn.
7. Sao lưu định kỳ; không xóa disk hoặc thay mount path khi cập nhật.

## Lỗi thường gặp

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| Origin không hợp lệ / 403 | `APP_ORIGIN` trên Render phải khớp chính xác URL frontend đang mở |
| `/api/auth/ws-ticket` trả 404 | Đã bật `WS_TICKET_AUTH=true` trên Render và deploy code mới chưa? |
| Ticket trả 401 | Phiên hết hạn hoặc cookie chưa được lưu; đăng nhập lại trên Vercel |
| Đăng nhập được nhưng socket không kết nối | Kiểm tra `wss://.../ws`, hai biến ticket=true và Redeploy frontend sau khi đổi biến |
| API Vercel trả 502 | Kiểm tra backend Live, health và `BACKEND_URL` đúng hostname, không có `/api` ở cuối |
| Dữ liệu biến mất sau restart | Disk đã gắn đúng `/var/data` và `DATA_DIR=/var/data` chưa? |
| Production chạy nhưng Preview không đăng nhập được | Backend chỉ chấp nhận Production origin đã cấu hình; không mở wildcard chỉ để chạy Preview |

Tài liệu chính thức: [Render FastAPI](https://render.com/docs/deploy-fastapi), [Persistent Disk](https://render.com/docs/disks), [WebSocket](https://render.com/docs/websocket), [Vercel build/root directory](https://vercel.com/docs/builds/configure-a-build).
