# Deploying PayTrack: Vercel + Render + SQLite

Next.js frontend on Vercel; FastAPI/WebSocket on Render; SQLite on Persistent Disk. A VPS and custom domain are not required. The addresses below are examples: replace them with the actual URLs assigned by the platforms.

## 1. Push the Code to GitHub

Create a private repository and push the latest source. If the local repository has no remote yet:

```powershell
cd "C:\Homework\JSD\New\New folder"
git status
git add .
git commit -m "Prepare PayTrack for Vercel and Render"
git remote add origin https://github.com/TEN_GITHUB/TEN_REPOSITORY.git
git push -u origin HEAD
```

If a remote already exists, omit `git remote add origin` and push the current branch. Keep `.gitignore` and `.dockerignore`: do not upload `.env`, databases, backups, `.venv`, `node_modules`, or `.next` to GitHub. Do not place a SQLite backup in a public repository.

## 2. Create the Render Backend

Render Dashboard → New → Web Service → connect the repository.

| Setting | Value |
| --- | --- |
| Name | `paytrack-api` or another available name |
| Language / Runtime | Docker |
| Branch | The branch pushed in step 1 |
| Root Directory | Leave empty to use the repository root |
| Dockerfile Path | `./deploy/render.Dockerfile` |
| Docker Build Context | `.` if this field is available |
| Docker Command | Leave empty; the image already defines its startup command |
| Health Check Path | `/api/health` |
| Instances | 1 |
| Instance type | A paid plan supporting Persistent Disk |

Attach a Persistent Disk before using real data:

| Setting | Value |
| --- | --- |
| Mount Path | `/var/data` |
| Size | 1 GB or an appropriate minimum offered by the interface |

Render preserves only files under the disk's mount path. The database is `/var/data/tracker.sqlite3`; backups are in `/var/data/backups`. Render Postgres is not required.

Add the following Environment Variables:

```env
DATA_DIR=/var/data
APP_ORIGIN=https://your-project.vercel.app
COOKIE_SECURE=true
WS_TICKET_AUTH=true
SESSION_SECONDS=28800
```

`APP_ORIGIN` initially contains an example address; update it in step 4. There is no need to set `PORT` manually: the entrypoint reads Render's assigned port. The Docker image runs one Uvicorn worker and applies migrations automatically at startup.

Create the service, wait for Live status, and open `https://TEN_BACKEND.onrender.com/api/health`. It must return `{"status":"ok"}`. The backend has no interface at `/`, so a 404 there is normal.

## 3. Create the Vercel Frontend

Vercel Dashboard → Add New → Project → import the same repository.

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `frontend` |
| Node.js Version | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Keep the Next.js default |

Add Production Environment Variables using the actual backend URL from step 2:

```env
BACKEND_URL=https://TEN_BACKEND.onrender.com
NEXT_PUBLIC_WS_URL=wss://TEN_BACKEND.onrender.com/ws
NEXT_PUBLIC_WS_TICKET_AUTH=true
```

Do not append `/api` to `BACKEND_URL`. `NEXT_PUBLIC_WS_URL` ends with `/ws`. `NEXT_PUBLIC_` variables are embedded during the build, so redeploy after changing them. Do not use `localhost`, `127.0.0.1`, or example URLs in the online deployment.

Deploy and obtain the stable Production URL from Domains, such as `https://paytrack-demo.vercel.app`. Use the stable Production URL rather than a per-commit Preview URL.

## 4. Connect the Two Services

Return to Render → Environment:

```env
APP_ORIGIN=https://paytrack-demo.vercel.app
```

Replace this with the actual Production URL without a trailing `/`. Save and allow Render to restart. Update `APP_ORIGIN` again if the frontend domain changes later.

Next.js proxies `/api/*` to Render; the HttpOnly cookie belongs to the frontend. The browser obtains a WebSocket ticket through `POST /api/auth/ws-ticket` and sends it to Render in the WebSocket subprotocol. Tickets are single-use and expire after 30 seconds, avoiding third-party cookies and wildcard CORS. Each reconnect obtains a new ticket. The backend still checks the session on every action, so logout revokes the open socket's authorization. Do not place tickets or cookies in URLs/logs.

## 5. Preserve Existing Accounts and SQLite Data

To retain the `tuna` account and sample data, use the one-time import below. For a fresh database, skip this step and register at the Vercel URL; the first account administers backups.

### 5.1 Create a Snapshot on Windows

In PowerShell, run from the backend directory:

```powershell
cd "C:\Homework\JSD\New\New folder\backend"
..\.venv\Scripts\python.exe -m app.cli backup --file "..\data\paytrack-deploy.sqlite3"
```

The CLI does not overwrite existing files. If this file already exists, choose another name and update subsequent steps accordingly. Use the project's backup API rather than copying only an open SQLite database file.

### 5.2 Transfer the File with Magic Wormhole

Use SCP as described in Render's Connect instructions, or Magic Wormhole in Render Shell. Transfer the file directly to Persistent Disk, not through GitHub.

In PowerShell on your machine:

```powershell
cd "C:\Homework\JSD\New\New folder"
.\.venv\Scripts\python.exe -m pip install magic-wormhole
.\.venv\Scripts\wormhole.exe send .\data\paytrack-deploy.sqlite3
```

Keep this terminal open and copy the transfer code printed by the command. Do not put the code in source files or share it publicly.

Render → backend service → Shell:

```bash
python -m pip install magic-wormhole
cd /var/data
wormhole receive
```

Enter the code from your machine and accept the file. Confirm it is located at `/var/data/paytrack-deploy.sqlite3`.

### 5.3 Import Before the Backend Starts

Add this Render variable:

```env
IMPORT_DATABASE_ONCE=/var/data/paytrack-deploy.sqlite3
```

Save and restart/redeploy the backend. Before Uvicorn starts, the entrypoint validates the file, backs up the destination database to `/var/data/backups/pre-render-import-*.sqlite3`, restores the snapshot, revokes old sessions, applies migrations, and renames the source to `paytrack-deploy.sqlite3.imported`. The success log reads: `SQLite import completed; old sessions revoked.`

Do not manually restore while the backend is serving requests. The entrypoint import avoids that situation. Renaming the source prevents subsequent restarts from importing again and overwriting new changes. After confirming success, remove `IMPORT_DATABASE_ONCE` from Render.

Log in on Vercel using the existing username/password. The local database remains unchanged. Do not register accounts or enter real data on Render before restoring unless you deliberately accept replacing the destination database with the local snapshot.

## 6. Post-Deployment Checks

1. Open `/api/health` on Render and `/api/health` on Vercel; both must return status ok.
2. Log in on Vercel and open Dashboard, Organizations, Payment Management, and Reports.
3. In Network, `/api/auth/ws-ticket` should return 200; Render's WebSocket `/ws` should upgrade with status 101 and exchange response messages.
4. Create/edit a payment, mark it paid, reload, and check the result.
5. Log out and back in; verify the data still belongs to the correct account.
6. Restart Render, log in again, and confirm the new record remains.
7. Back up regularly; do not delete the disk or change its mount path during updates.

## Troubleshooting

| Symptom | What to Check |
| --- | --- |
| Invalid Origin / 403 | Render's `APP_ORIGIN` must exactly match the frontend URL being used |
| `/api/auth/ws-ticket` returns 404 | Confirm `WS_TICKET_AUTH=true` on Render and that the latest code is deployed |
| Ticket endpoint returns 401 | The session expired or the cookie was not stored; log in again on Vercel |
| Login works but the socket does not connect | Check `wss://.../ws`, both ticket flags set to true, and frontend redeployment after variable changes |
| Vercel API returns 502 | Check backend Live status, health, and the correct `BACKEND_URL` hostname without a trailing `/api` |
| Data disappears after restart | Check the `/var/data` disk mount and `DATA_DIR=/var/data` |
| Production works but Preview login fails | The backend accepts only the configured Production origin; do not enable a wildcard merely to allow Preview |

Official documentation: [Render FastAPI](https://render.com/docs/deploy-fastapi), [Persistent Disk](https://render.com/docs/disks), [WebSocket](https://render.com/docs/websocket), [Vercel build/root directory](https://vercel.com/docs/builds/configure-a-build).
