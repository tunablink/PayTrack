# Local/VPS Operations and Data Management

## Local Development

Requires Node.js 24 LTS and Python 3.13. Docker is not required for local development.

```powershell
# From the repository root; use the installed Python executable if python/py is a Windows Store alias.
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock.txt
cd backend
..\.venv\Scripts\python.exe -m app.cli setup
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --ws-max-size 32768
```

In another terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:3000**. The default Origin is exactly this address; if using 127.0.0.1 or a different port, set the backend APP_ORIGIN and frontend NEXT_PUBLIC_WS_URL accordingly. The root `.env.example` is a Compose template. The CLI/backend reads process environment variables and does not automatically load .env. Next.js automatically reads `.env.local`; copy `frontend/.env.example` to that file if needed.

On Linux, use `python3 -m venv .venv`, `.venv/bin/python`, and `npm`; other commands remain the same. Run the CLI and backend from `backend/` so the default DATA_DIR points to the root `data/` directory. DATA_DIR can also be an absolute path outside the repository.

One person may register multiple accounts at **http://localhost:3000/register** or through the registration link on the login page. Each account needs a distinct username, a password of at least 12 characters, and matching confirmation. After successful registration, log in. Registration remains open when accounts already exist. Organizations, payments, and statistics are isolated by account; log out and log in to another account to switch workspaces. Registration is limited to 10 schema-valid requests/IP/15 minutes to reduce abuse; duplicate names produce an error while retaining the form for correction.

The `python -m app.cli setup` command creates the initial administrator through terminal getpass prompts, only when no accounts exist. The legacy account or first account in an empty database retains administrator access to whole-system backups. Subsequent registered accounts cannot access whole-system backup/status or see the backup button. Administrator privileges do not grant API access to another account's organizations/payments.

**Upgrading an existing database:** stop and restart the backend. Before migrating database version 1 to 2, migration 002 automatically creates `DATA_DIR/backups/pre-migration-002-<id>.sqlite3` through the SQLite backup API. Usernames, password hashes, organizations, payments, record versions, and valid sessions are preserved; existing data belongs to the initial account. Do not delete the database to enable registration. With Docker, rebuild the image and recreate the backend while preserving the data volume.

## Local Docker

```bash
cp .env.example .env
docker compose --env-file .env -f deploy/compose.yaml build
docker compose --env-file .env -f deploy/compose.yaml run --rm backend python -m app.cli setup
docker compose --env-file .env -f deploy/compose.yaml up -d
docker compose --env-file .env -f deploy/compose.yaml ps
```

Open http://localhost on port 80. The frontend is built with `/ws`; Nginx forwards HTTP and WebSocket traffic to the backend under the same origin. Backend/database ports are not exposed. The `tracker-data` named volume mounts the entire `/data` directory, including SQLite, WAL, and backups.

## Linux VPS with a Domain

1. Prepare a VPS with Docker Engine and Compose **>=2.24.4** installed (`!override` is used in the HTTPS override). The repository does not purchase resources automatically.
2. Point DNS A/AAAA records to the VPS, open ports 80/443 and the required SSH port, and expose only the reverse proxy.
3. Copy the source and create a private `.env` with `DOMAIN=tracker.ten-mien-cua-ban`, `APP_ORIGIN=https://tracker.ten-mien-cua-ban`, `COOKIE_SECURE=true`, and `SESSION_SECONDS=28800`.
4. Use both Compose files to replace Nginx with Caddy for automatic TLS issuance/renewal and WebSocket upgrades:

```bash
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.https.yaml build
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.https.yaml run --rm backend python -m app.cli setup
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.https.yaml up -d
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.https.yaml logs --tail=100
```

Caddy stores certificates in a separate volume. Do not enable Secure cookies for local HTTP testing; enable Secure for HTTPS production. The reverse proxy overwrites X-Real-IP, and the backend trusts that header only in secure configuration. Use one backend process, do not scale SQLite replicas, and do not put the data directory on a network filesystem.

## Backup

The desktop interface provides a **Data Backup** button on the left. `backup.start` uses the SQLite backup API in a thread pool; `backup.status` reports queued/running/completed/failed. Success is reported only after completion and integrity_check=ok. Files are stored at `DATA_DIR/backups/<job-id>.sqlite3` and are not served through a URL. Job metadata in RAM is lost on restart.

Local CLI, run from backend:

```bash
python -m app.cli backup --file /duong-dan-rieng/backup-2026-11-02.sqlite3
```

Docker:

```bash
docker compose --env-file .env -f deploy/compose.yaml exec backend python -m app.cli backup --file /data/backups/manual-2026-11-02.sqlite3
docker compose --env-file .env -f deploy/compose.yaml cp backend:/data/backups/manual-2026-11-02.sqlite3 ./backup-2026-11-02.sqlite3
```

The destination directory is created when needed; the CLI refuses to overwrite existing files. Back up a consistent snapshot rather than copying only `.sqlite3` while WAL is active. Backups contain data and password/session hashes, so keep them private with restrictive permissions and an appropriate retention policy. Do not commit them to Git.

## Restore

1. Stop the backend before restoring and retain a fresh backup of the current data.
2. The CLI checks source integrity and restores through the backup API. Enter `RESTORE` when prompted. All sessions are revoked.

```bash
# Local (backend/)
python -m app.cli restore --file /duong-dan-rieng/backup-2026-11-02.sqlite3
# Docker, with the source file already in the /data/backups volume
docker compose --env-file .env -f deploy/compose.yaml stop backend
docker compose --env-file .env -f deploy/compose.yaml run --rm --no-deps backend python -m app.cli restore --file /data/backups/manual-2026-11-02.sqlite3
docker compose --env-file .env -f deploy/compose.yaml up -d backend
```

Log in again and compare organization/payment counts and totals before and after restoration. The pytest suite performs backup/restore against temporary SQLite databases and checks amounts; it also executes real CLI backup/restore subprocesses and verifies session revocation. Production operations still require a restore rehearsal on a copy first.

## Updates and Persistence Checks

Back up first, fetch the updated source/lock file, and run `docker compose ... up -d --build`. Migrations use `PRAGMA user_version`, run at startup, and do not seed data automatically. Do not use `down -v`, which deletes volumes. After recreating containers, log in, compare Dashboard/Report totals, and check health. Future migrations must use new sequential files added to MIGRATIONS; do not edit migrations already applied in production.

The deployment configuration includes restart policies, health checks, and log rotation of 10 MB × 3. Use `docker compose ... logs backend` to inspect action duration and backup thread names/IDs; application logs do not include credentials or business payloads. The reverse proxy does not log bodies/cookies by default.

## Demo Seed and Tests

Seeding is manual and intended only for an empty demo database:

```bash
# From backend; DATA_DIR must point to a separate demo directory.
python -m app.cli seed --confirm-empty-demo
```

```powershell
# Backend, from backend/
..\.venv\Scripts\python.exe -m pytest -q
# Frontend, from frontend/
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

Playwright uses installed Chrome by default; set `E2E_BROWSER_CHANNEL=msedge` to use Edge. The E2E backend creates a separate temporary database and a random password in process environment variables, without modifying local data. Ports 3000/8000 must be free. Test reports/errors are stored in frontend/test-results (Git-ignored); they may contain test data and should not be published.
