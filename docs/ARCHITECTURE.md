# Architecture and Contracts

## Components

- Next.js App Router: layouts and route pages are Server Components; the workspace, login, forms, and dialogs are Client Components because they require interaction. Tailwind is built through PostCSS; shared CSS defines the design components.
- FastAPI: HTTP is used only for authentication, session management, logout, and health checks. Business operations use WebSocket `/ws`.
- `schemas.py`: validates each action, rejects unknown fields, and enforces length/value limits, work dates, and the two payment statuses.
- `registry.py`: an allowlist registration decorator detects duplicate names, reflection checks the `(ctx, payload)` signature, and a wrapper logs processing time. New handlers are added through the decorator without modifying the dispatcher.
- `dispatcher.py`: authenticates every message inside a transaction, validates input, handles idempotency, and commits before responding.
- `services.py`: business rules, shared statistics, and parameterized queries. `repository.py`: independent SQLite connections per task and migrations.
- `executor.py`: a ThreadPoolExecutor with at most 2 workers and at most one active backup; a Lock protects state, logs include thread names/IDs, and shutdown waits for outstanding work.
- SQLite is the only database; each connection enables PRAGMA foreign_keys, with WAL and busy_timeout=3000 ms. Use one backend process and do not mount data over a network filesystem.
- Migration 002 moves `owner` to `users` and attaches `user_id` to sessions, organizations, payments, and idempotency records. Version 1 databases are backed up using the backup API before migration; existing accounts, data, and sessions are preserved. The composite foreign key `(organization_id,user_id)` prevents payments from linking to another account's organization.

WebSocket runs over TCP and is **not a raw TCP socket API**. Async/await does not count as multithreading. SQL and Argon2 run through AnyIO's thread pool with its default limit; SQLite backup runs in a separate ThreadPoolExecutor. No claim is made that threading accelerates CPU-bound work.

## Messages

```json
{"requestId":"correlation-id","action":"organization.create","payload":{"name":"Organization A","notes":""},"idempotencyKey":"independent-random-write-key"}
```

```json
{"requestId":"correlation-id","success":true,"data":{"id":1,"name":"Organization A","version":1}}
```

```json
{"requestId":"correlation-id","success":false,"error":{"code":"CONFLICT","message":"The data was changed in another tab. Reload before editing."}}
```

Actions: `organization.list/create/update/delete`, `payment.list/create/update/delete/updateStatus`, `dashboard.summary`, `report.summary`, `system.ping`, `backup.start/status`.

- Each write requires its own `idempotencyKey` (16–100 characters), stored with an action/payload fingerprint and the result in the same transaction. Keys are partitioned by user_id, so two accounts using the same key cannot read each other's results. Reusing a key with identical content returns the committed result; different content within the same account returns IDEMPOTENCY_CONFLICT. The cache survives restarts and is not automatically cleared; account for its storage requirements during long-term use.
- Update/delete/status actions require `id` and `version`. `BEGIN IMMEDIATE` and version checks prevent two tabs from silently overwriting each other. Writes are not automatically retried.
- The frontend timeout is 12 seconds; pending requests are rejected and cleared on disconnect. If a write may already have committed, the interface reports an uncertain outcome, retains the dialog, and reloads after reconnection.
- Application-level `system.ping` runs every 15 seconds; the browser does not send raw protocol ping frames. Reconnection uses exponential backoff with 0.75–1.25 jitter and a maximum wait of 30 seconds. A backend snapshot is always fetched after reconnection. Reloading every 15 seconds and on window focus reflects changes made in other tabs.
- Going offline preserves the previous snapshot for viewing and disables writes. There is no offline write queue.
- Application messages are limited to 32 KiB; production Uvicorn also limits frames/messages to 32 KiB. Invalid JSON/schema/action requests receive error codes without traces or secrets.
- HTTP POST and WebSocket Origins must exactly match APP_ORIGIN. Broad CORS is not used. The production host/proxy exposes only ports 80/443.

## Money and Dates

- Unit prices range from 0 to 1,000,000,000,000 VND; Decimal quantities must be greater than 0 and at most 1,000,000, with up to 3 decimal places. Each record's amount is limited to 1,000,000,000,000,000 VND.
- The backend multiplies Decimal values and uses ROUND_HALF_UP to round to whole dong. Client-supplied amounts are rejected as fields outside the schema. SQLite stores prices/amounts as INTEGER and quantities as TEXT to preserve Decimal values.
- Dashboard and Report use the same aggregation function within read transactions. Total = paid + unpaid; counts and organization/month groups use the same filters.
- Work dates are ISO dates without a timezone; the frontend formats them as dd/MM/yyyy by splitting the string. Created/updated timestamps are stored in UTC and displayed in Asia/Ho_Chi_Minh. The UI uses vi-VN formatting and VND.
- Within the same write transaction, the backend checks that the portfolio total does not exceed 2^53−1 = 9,007,199,254,740,991 VND. This protects JSON/JavaScript integer precision and SQLite totals; operations exceeding the limit are rejected before commit.

## Authentication

- Multiple accounts with unique usernames are supported. One person may create multiple accounts under different names, each with separate data. Passwords use Argon2id, require at least 12 characters, and must match the confirmation. Registration does not create a session automatically; users log in after successful registration.
- POST `/api/auth/register` checks Origin/CSRF and the schema; duplicate names receive USERNAME_TAKEN (409), and the limit of 10 attempts/IP/15 minutes returns RATE_LIMIT (429). Registration remains open; GET `/api/auth/registration` returns available=true for compatibility. A unique constraint and transactions protect concurrent registration; only the first account receives is_admin=1. CLI setup still creates the first administrator and does not add administrators when accounts already exist. Validation errors do not echo passwords or request bodies.
- The dispatcher obtains user_id from the authenticated session, not the client payload. All CRUD, filters, statistics, and total-amount limits are scoped to user_id. Another account's ID returns NOT_FOUND or an invalid-organization error. Administrators can also view only their own business data.
- Session tokens contain 48 random bytes; only their SHA-256 digest is stored in SQLite. Cookies are HttpOnly, SameSite=Strict, and Secure when COOKIE_SECURE=true. Credentials are not placed in URLs, localStorage, or logs.
- The default fixed expiry is 8 hours, without sliding refresh. Sessions survive backend restarts because they are stored in SQLite. Restore deliberately clears all sessions.
- Logout deletes the session. Logging in or switching accounts revokes the browser's previous cookie session so its old socket cannot continue performing actions. Every WebSocket action rechecks the session; idle sockets are checked at least every 30 seconds. Revoked sessions cannot perform business operations.
- Login is limited to 5 failed attempts/IP/15 minutes, recorded in SQLite so the limit survives restarts. Nginx/Caddy overwrite X-Real-IP; the backend is not public and trusts that header only in secure production mode.
- Whole-database backups contain multiple accounts' data, so backup.start/status require is_admin=1. The initial account migrated from owner retains this permission; additional registered accounts do not see the backup button, and the backend rejects their backup actions. Backups remain in a private directory with no download endpoint/static URL. Job status is held in memory and is lost on restart; backup files remain. CLI backup/restore is intended for the server administrator.

## Official References Used

- [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation)
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
