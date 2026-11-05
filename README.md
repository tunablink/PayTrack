# PayTrack — Personal Payment Tracking System

## 1. Team Information

| Item | Details |
| --- | --- |
| Project title | Personal Payment Tracking System |
| Group | 12 |
| Course | Java Software Development |
| Academic year | 2026–2027 |
| Instructor | Ngô Văn Quyền |
| Technology stack | Next.js, Python/FastAPI, WebSocket, SQLite |

| Student ID | Full name | Responsibilities |
| --- | --- | --- |
| 2301040089 | Ngô Thị Thanh Hương | Python backend, data validation, and business logic |
| 2301040012 | Tống Phương Anh | Next.js frontend, interface, and client state |
| 2301040102 | Nguyễn Thị Thuỳ Linh | SQLite, deployment, integration, and testing |
| 2301040206 | Lê Thị Hải Yến | Socket networking, multithreading, and metaprogramming |
| 2301040208 | Nguyễn Thị Hoàng Yến | Requirements, documentation, and testing |

## 2. Current Features and Interface

The interface uses the **Inter** font, an orange primary color, and neutral backgrounds, with desktop and mobile layouts. The header displays an initials avatar, the account name, and a logout button. Business data refreshes automatically every 15 seconds and after reconnection; the pages have no Refresh button.

### Login and Registration

- `/login`: username and password.
- `/register`: username, password, and password confirmation; passwords must contain at least 12 characters.
- Multiple accounts can be created with distinct usernames; registration remains open after the first account is created.
- Duplicate usernames and mismatched password confirmations produce errors. Successful registration directs the user to log in.
- Both pages have a white background, the PayTrack logo/name in the upper-left corner, a centered form, 54px-high inputs, and 16px input text.
- Passwords are hashed with Argon2. Sessions use HttpOnly cookies; HTTPS production deployments enable the Secure cookie attribute.
- The first account administers whole-system backups. This permission does not grant access to another account's business data.

### Dashboard — `/dashboard`

The page contains the following sections:

1. Total receivables, collection progress, an add-payment action, and report export.
2. Cash flow status: received payments, outstanding receivables, and the overdue portion.
3. Quick actions and reminders: view a payment requiring collection, add a payment, and add an organization.
4. Recent payments: All / Unpaid / Paid filters, pagination, and detail views.
5. Receipt history: paid records ordered by their most recent update.
6. Revenue share by partner.

The current month is selected by default; Week / Month / Quarter controls update all sections together. The reconciliation-period selector, work-date range caption, and long subtitle have been removed. An unpaid payment is overdue when its payment due date has passed.

Receipt history currently uses record update timestamps. It is not a bank transaction ledger or a separate record of actual receipt dates.

### Organizations — `/organizations`

Columns appear in the following order:

**Organization Name → Type → Representative → Contact Information → Address → Notes → Status → Actions.**

- Create, view, edit, and delete organizations; store their type, representative, email, phone number, address, and notes.
- Status values are **Active** (`ACTIVE`) and **Inactive** (`INACTIVE`).
- Filters include name search, organization type drawn from existing records, and status. Criteria can be combined, and the search field is the widest control.
- Email addresses and phone numbers use `mailto:`/`tel:` links. Organizations with linked payments cannot be deleted.

### Payment Management — `/payments`

Columns appear in the following order:

**Organization → Item → Quantity → Unit Price → Total Amount → Payment Due → Status → Actions.**

- Create, view, edit, and delete payments; search items and filter by organization, status, and work-date range.
- The backend calculates amounts with `Decimal` and rounds to the nearest dong; VND amounts are stored as integers.
- **Payment Due** (`due_date`) is independent of the work date (`work_date`). It can be entered, edited, or cleared; a missing due date is displayed as `—`.
- The paid checkbox is located in the Status column. Status changes require confirmation and are displayed after the backend responds.
- Stored payment statuses are `PAID` / `UNPAID`. The dashboard's overdue label is derived from an unpaid status and the payment due date.
- The page no longer displays the three Total Receivables / Received / Outstanding summary cards at the top.

### Reports — `/reports`

- Four metrics: **Total Contract Revenue**, **Total Payments Received**, **Outstanding Balance**, and **Receivables Collection Rate**.
- Collection rate = received amount / total value × 100%; a zero total displays 0%.
- Filters below the metrics: **Year**, **Partner**, and **Last 6 Months / By Quarter / Full Year**.
- Full Year and By Quarter use the selected year; By Quarter groups chart data into quarters. Last 6 Months covers six months through today for the current year, or July–December when another year is selected.
- Filters update **Cash Flow Trends**, **Status Distribution**, and **Outstanding Receivables by Organization** together.
- The organization/month reconciliation tables and the previous organization / status / start-date / end-date / reset controls have been removed.
- The **Export Report** button in the upper-right corner downloads data matching the current filters.

Dashboard and report exports produce **UTF-8 CSV files with a BOM that can be opened in Excel**; `.xlsx` and PDF exports are not implemented. Statistics use work dates. “Contract revenue” labels the total value of payment records; a separate contract-management module is not implemented.

## 3. Architecture and Technical Implementation

```text
Browser
  ├─ HTTPS → Next.js frontend on Vercel
  │              └─ /api/* → FastAPI on Render
  └─ WSS + one-time connection ticket → /ws on Render
                                           ├─ Pydantic validation
                                           ├─ Dispatcher + action registry
                                           ├─ Services + SQLite transactions
                                           └─ SQLite on Persistent Disk
```

| Component | Implementation |
| --- | --- |
| Networking | Bidirectional WebSocket JSON over TCP/IP, request IDs, a 15-second heartbeat, timeouts, and automatic reconnection |
| Multithreading | `run_in_threadpool` for synchronous processing; a bounded `ThreadPoolExecutor` for backups; locks protecting job state and connection tickets |
| Metaprogramming | The `@registry.action(...)` decorator, handler validation with `inspect.signature`, execution-time wrappers, and dispatch through an allowlisted action registry |
| Consistency | Transactions, record versions to prevent conflicting updates, and idempotency keys for writes |
| Authorization | Server-side session and `user_id` checks; foreign keys preventing cross-account data links |

WebSocket is a browser-compatible socket protocol running over TCP/IP, rather than the raw TCP `socket.socket` API. Async I/O and multithreading are separate mechanisms in this project.

### Authentication Across Vercel and Render Hostnames

1. The frontend proxies HTTP `/api/*` requests to Render; the HttpOnly cookie belongs to the frontend hostname.
2. When ticket authentication is enabled, the client calls `POST /api/auth/ws-ticket` with its existing session.
3. The backend issues a one-time ticket that expires after 30 seconds. The client sends it to Render through a WebSocket subprotocol.
4. The backend validates the Origin, ticket, and session before accepting the connection, then checks the session on every action.
5. Reconnection obtains a fresh ticket; logout revokes the session and the open socket's authorization.

Third-party cookies and wildcard CORS are not required. Local or same-origin Docker deployments can continue using cookie-based WebSocket authentication when ticket authentication is disabled.

### WebSocket Message Contract

Example payment status update:

```json
{
  "requestId": "req-104",
  "action": "payment.updateStatus",
  "payload": { "id": 12, "version": 1, "status": "PAID" },
  "idempotencyKey": "unique-key-for-this-write"
}
```

Responses include the same `requestId`, `success`, and either `data` or an `error` containing `code` and `message`. Write actions require an `idempotencyKey`; updates and deletions require the appropriate record version.

Action groups: `organization.list/create/update/delete`, `payment.list/create/update/delete/updateStatus`, `dashboard.summary`, `report.summary`, `report.years`, `system.ping`, and `backup.start/status`.

## 4. SQLite Database

| Environment | Location |
| --- | --- |
| Local, with the backend started from `backend/` | `data/tracker.sqlite3` at the repository root |
| Render with the current configuration | `/var/data/tracker.sqlite3` |
| Local/VPS Docker Compose | `/data/tracker.sqlite3` in the `tracker-data` volume |

`DATA_DIR` specifies the directory containing SQLite and backups. The backend uses the `sqlite3` library; PostgreSQL and a separate database container are not required. Database files and backups must not be committed to Git or served as static assets.

Migrations run automatically when the backend starts, using `PRAGMA user_version`:

| Migration | Purpose |
| --- | --- |
| `001_initial.sql` | Initial schema |
| `002_multiple_accounts.sql` | Multiple accounts, sessions, and `user_id` ownership; preserves existing data and creates a backup before upgrading from version 1 |
| `003_organization_details.sql` | Extended organization information and status |
| `004_payment_due_date.sql` | Separate, optional payment due date; preserves existing work dates |

## 5. Running Locally

Requirements: **Node.js 24** and **Python 3.13**. The following commands use PowerShell from the repository root.

### Initial Dependency Installation

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock.txt
cd frontend
npm.cmd ci
```

If `python` resolves to the Windows Store alias, use the installed Python executable or `py -3.13` to create the virtual environment. Existing virtual environments and dependencies do not need to be reinstalled each time the application starts.

### Terminal 1 — Backend

```powershell
cd backend
$env:APP_ORIGIN="http://localhost:3000"
$env:COOKIE_SECURE="false"
$env:WS_TICKET_AUTH="false"
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --ws-max-size 32768
```

Start from `backend/` so the default `DATA_DIR` correctly resolves to `../data`. The backend reads process environment variables and does not load `.env` automatically.

### Terminal 2 — Frontend

```powershell
cd frontend
npm.cmd run dev
```

Open **http://localhost:3000**. The local configuration template in `frontend/.env.example` can be copied to `frontend/.env.local`:

```env
BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

For a new database, register at `/register`, then log in. The `python -m app.cli setup` command creates the first administrator only when no accounts exist; it is not used to add subsequent accounts.

On Linux/macOS, use `python3`, `.venv/bin/python`, and `npm` in place of the corresponding Windows commands and paths.

## 6. Vercel + Render Deployment

Full deployment instructions: **[docs/DEPLOY_VERCEL_RENDER.md](docs/DEPLOY_VERCEL_RENDER.md)**.

Addresses used during deployment:

- Frontend: [pay-track-app-phi.vercel.app](https://pay-track-app-phi.vercel.app).
- Backend health: [pay-track-app.onrender.com/api/health](https://pay-track-app.onrender.com/api/health).
- Repository: [tunablink/Pay_Track_App](https://github.com/tunablink/Pay_Track_App).

The person deploying the application has confirmed that the backend health endpoint works. Complete online operation still requires verification of the Origin configuration, login/WebSocket authentication, and persistence; local test results do not replace cloud deployment checks.

### Render — Backend and SQLite

| Setting | Value |
| --- | --- |
| Runtime | Docker |
| Root Directory | Leave empty |
| Dockerfile Path | `./deploy/render.Dockerfile` |
| Docker Build Context | `.` |
| Docker Command | Leave empty; the image runs `python -m app.render_start` |
| Health Check Path | `/api/health` |
| Instances | 1 |
| Persistent Disk Mount Path | `/var/data` |

Persistent Disk requires a paid Render service. Do not use the temporary filesystem for durable SQLite storage. The entrypoint reads Render's `PORT`, starts one Uvicorn worker, and applies migrations during startup.

Environment variables for the frontend URL above:

```env
DATA_DIR=/var/data
APP_ORIGIN=https://pay-track-app-phi.vercel.app
COOKIE_SECURE=true
WS_TICKET_AUTH=true
SESSION_SECONDS=28800
```

### Vercel — Frontend

Import **frontend / Next.js** as a single project from the repository, rather than a multi-service project for this deployment arrangement.

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework / Application Preset | Next.js |
| Node.js | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Next.js default |

```env
BACKEND_URL=https://pay-track-app.onrender.com
NEXT_PUBLIC_WS_URL=wss://pay-track-app.onrender.com/ws
NEXT_PUBLIC_WS_TICKET_AUTH=true
```

Redeploy the frontend after changing environment variables because `NEXT_PUBLIC_*` values are embedded during the build. Use a stable Production URL. If the hostname changes, update the relevant URLs and `APP_ORIGIN`.

**403 Origin error:** `APP_ORIGIN` on Render must exactly match the frontend origin, including `https://`, without `/login`, `/register`, or a trailing slash. For the current URL, use `https://pay-track-app-phi.vercel.app`, then save and restart/redeploy Render. Do not enable a wildcard Origin to resolve this error.

A backend `GET /` or `HEAD /` returning 404 is normal; the health endpoint is `/api/health`. A 401 response from `/api/auth/session` is also normal when the user is not logged in.

## 7. Backup, Restore, and Data Transfer

- Administrators have a data backup action; the backend uses a thread pool for SQLite backups and reports the job status.
- Backups are stored in `DATA_DIR/backups`, with no public download URL. The CLI supports backup/restore for operators.
- Use the SQLite backup API instead of copying only the database file while WAL is active.

Create a local snapshot from `backend/`:

```powershell
..\.venv\Scripts\python.exe -m app.cli backup --file "..\data\paytrack-deploy.sqlite3"
```

The CLI refuses to overwrite an existing backup. Transfer the snapshot to the Render disk using SCP or Magic Wormhole, then configure:

```env
IMPORT_DATABASE_ONCE=/var/data/paytrack-deploy.sqlite3
```

Restart/redeploy the backend. Before starting Uvicorn, the entrypoint validates the snapshot, backs up the destination database, restores the data, revokes old sessions, applies migrations, and renames the source file with an `.imported` suffix. Subsequent restarts do not reimport the renamed file. Remove `IMPORT_DATABASE_ONCE` after confirming a successful import.

Restoring replaces the destination database with the snapshot, so complete this step before entering new data online. The local database is preserved. For a regular CLI restore, stop the backend first; see [OPERATIONS](docs/OPERATIONS.md).

## 8. Sample Data for UI Demonstrations

The `backend/scripts/seed_ui_demo.py` script adds fictional demonstration data to an existing account:

```powershell
# From the repository root; replace USERNAME with the target account's username.
.\.venv\Scripts\python.exe backend\scripts\seed_ui_demo.py --username USERNAME
```

- Adds 12 organizations across 8 types, including active and inactive organizations.
- Adds 138 payments: 24 for the month in which the script runs, plus records covering the preceding 12 months.
- Includes paid/unpaid records, overdue/upcoming/missing due dates, and varied quantities and unit prices.
- Marks organization notes with `[UI-DEMO v1]`; creates a backup before insertion, preserves existing records, and prevents duplicate seeding of the same sample set.
- Email addresses use `example.com`; names, contact information, and business records are fictional.

During UI preparation on **4 November 2026**, this data was added to the local `tuna` account, bringing its total to **13 organizations and 139 payments**. These figures describe that dataset at that time, rather than fixed totals for every database. The records do not appear on Render automatically; transfer the SQLite snapshot to include them.

## 9. Testing

The most recent local checks during deployment preparation passed **60 backend tests** and **18 desktop/mobile UI tests** covering Dashboard, Organizations, Payment Management, Registration, and Reports. TypeScript, ESLint, and the production build also passed. A browser test across different hostnames verified login, ticket-based WebSocket authentication, CRUD, offline/reconnection behavior, and logout revocation using a temporary database.

```powershell
# Backend: run from backend/
..\.venv\Scripts\python.exe -m pytest -q

# Frontend: run from frontend/
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Run the following UI checks with the frontend available at `http://localhost:3000`. These tests use isolated data, authentication, and WebSocket fixtures:

```powershell
$env:E2E_EXTERNAL_SERVERS="1"
node node_modules/@playwright/test/cli.js test tests/dashboard.spec.ts tests/organizations.spec.ts tests/payments-table.spec.ts tests/registration.spec.ts tests/report-charts.spec.ts
```

Verify authentication across different hostnames, also with the local frontend running:

```powershell
node scripts/check-remote-socket.mjs
```

The script creates its own temporary backend/database and stops that backend when finished. Do not use real business data for testing. See [docs/TESTING.md](docs/TESTING.md), and verify health, login, WebSocket connectivity, and data persistence after a cloud restart before confirming deployment completion.

## 10. Source Code Structure

```text
frontend/
  app/                         # login, register, dashboard, organizations, payments, reports
  components/                  # forms, tables, header, dashboard, and charts
  lib/                         # socket client, types, and report utilities
  scripts/                     # production start, E2E runner, remote socket verification
  tests/                       # Playwright
backend/
  app/
    main.py                    # HTTP authentication, health, and WebSocket endpoint
    auth.py                    # passwords, sessions, login/registration rate limits
    config.py                  # environment configuration
    schemas.py                 # Pydantic validation
    dispatcher.py              # sessions, transactions, record versions, and idempotency
    services.py                # business logic and statistics
    registry.py                # decorators, reflection, and action timing
    repository.py              # SQLite access and migrations
    executor.py                # backup thread pool
    ws_tickets.py              # one-time WebSocket tickets
    render_start.py            # Render startup and one-time SQLite import
    cli.py                     # setup, backup, restore, and basic seed commands
  migrations/                  # migrations 001–004
  scripts/seed_ui_demo.py       # varied UI demonstration data
  tests/                       # pytest, integration, and TCP/WebSocket tests
deploy/                        # Dockerfiles, Compose, Nginx/Caddy, Render environment template
docs/                          # operations, testing, progress, and deployment instructions
data/                          # local SQLite database and backups; ignored by Git
```

## 11. Limitations and Future Work

- Bank integration, money transfers, partial payments, tax invoices, and an independent transaction history ledger are not implemented.
- Offline editing and later synchronization are not supported; write operations require a backend connection.
- SQLite and job/ticket state currently use one backend instance; multiple instances sharing a database file over a network filesystem are not supported.
- `.xlsx`/PDF export and business spreadsheet imports are not implemented; CSV export and SQLite snapshot imports are separate features.
- Production performance benchmarks have not been collected for publication.
- Course reports, evidence of networking/multithreading/metaprogramming, technology requirements, and submission requirements should be checked against the instructor's guidance.

## 12. Related Documentation

- [Vercel + Render Deployment](docs/DEPLOY_VERCEL_RENDER.md)
- [Local/Docker Operations and Backup/Restore](docs/OPERATIONS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)
- [Progress](docs/PROGRESS.md)
- [Next.js](https://nextjs.org/docs), [FastAPI WebSocket](https://fastapi.tiangolo.com/advanced/websockets/), [SQLite](https://www.sqlite.org/docs.html)
- [Python ThreadPoolExecutor](https://docs.python.org/3/library/concurrent.futures.html), [inspect](https://docs.python.org/3/library/inspect.html)
- [Render Persistent Disk](https://render.com/docs/disks), [Render WebSocket](https://render.com/docs/websocket), [Vercel Build Configuration](https://vercel.com/docs/builds/configure-a-build)
