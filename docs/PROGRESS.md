# Progress — 2 November 2026

## Completed and Verified Locally

- Reviewed README.md (README_UPDATED.md was absent), all HTML/scripts/design files, and the inventory of 4 HTML files, 4 PNG files, and 1 Markdown file. Preserved the Stitch directory and saved the old README in docs/README_ORIGINAL.md.
- Next.js App Router/TypeScript/Tailwind: login, dashboard, organizations, payments, and reports; shared shell/button/field/dialog/table/badge/error/empty/connection components; self-hosted font and Lucide icons.
- FastAPI/SQLite backend: schema/registry/dispatcher/services/repository/auth/config/executor; migrations, WAL/FK/timeout, persistent sessions across restarts, CSRF/Origin checks, and rate limits.
- CRUD, filtering/search/pagination, two payment statuses, consistent statistics, Decimal HALF_UP rounding, safe portfolio total limits, idempotency/version checks, and uncertain-write outcome handling.
- Backup API/thread pool/status/private storage; CLI setup/backup/restore/seed; restore revokes sessions.
- 25/25 backend tests passed; lint/typecheck/production build passed; the final 4/4 desktop/mobile Playwright tests passed, covering view/edit/delete, status changes, filters, offline/reconnection, backup, and a lost response after commit.
- Inspected desktop/mobile runtime screenshots and checked for page-wide horizontal overflow. Test data was confined to temporary databases. Test child processes were stopped afterward.
- Dockerfiles, HTTP/HTTPS Compose configurations, persistent volume, proxy, and operations guide; both Compose configurations passed configuration validation.
- README, audit, architecture, operations, and testing documentation were updated to reflect observed results.

## Work Requiring a Deployment Environment

- The Docker daemon was not running: images had not been built/run, and data persistence through container recreation had not been verified.
- No VPS/domain was available: TLS/WSS and proxy behavior had not been tested on a real VPS.
- Mobile checks used Chrome emulation; real Safari/iOS/Android devices had not been tested.
- Development dependency audit reported 16 moderate findings in the ESLint/minimatch chain; the production audit reported 0 vulnerabilities.

See TESTING.md and OPERATIONS.md to repeat the unverified steps. No VPS/domain or public resources were created.

## Update — 3 November 2026

- Changed the entire interface font from Be Vietnam Pro to Inter as requested; retained weights 400/500/600/700, self-hosted through @fontsource/inter 5.3.0, and updated package-lock.json.
- Updated /payments: moved the Paid action to a checkbox in the leftmost column. Checking/unchecking retained confirmation, connection checks, and state changes only after backend commit. Updated Playwright coverage for canceling confirmation and both status transitions.
- Fixed the header by extracting WorkspaceHeader and a dedicated CSS Module so styles stay with the component; avatar/name/role/logout followed the intended layout. Isolated Playwright checks on the development server passed 2/2 desktop/mobile cases, including long names, without accessing or modifying real data.

## Update — 4 November 2026: First-Owner Registration

- Added /register and a registration link on /login only when no owner existed.
- The form included username, a password of at least 12 characters, and password confirmation, with errors and submission disabled while processing. After successful saving, the user proceeded to login.
- Added GET /api/auth/registration and POST /api/auth/register, with Origin, schema, Argon2, and transaction checks enforcing one owner. Registration closed after an owner existed, including owners created through the CLI. Tests did not modify real databases or accounts.
- 34/34 backend tests passed, including registration, confirmation, hashing, CSRF, concurrency, and login after registration.
- 4/4 desktop/mobile registration Playwright tests passed (22.6 seconds). These isolated UI tests mocked auth endpoints; real APIs were tested separately through pytest with temporary databases.
- Production build passed with /register; desktop/mobile form screenshots were inspected. README, OPERATIONS, and ARCHITECTURE were updated.

## Update — 4 November 2026: Multiple Accounts

- Removed the single-owner limit following the new requirement: /register always allows accounts with distinct usernames, passwords, and password confirmation. Duplicate names return USERNAME_TAKEN while retaining the form; registration is limited to 10 requests/IP/15 minutes.
- Migration 002 creates users and attaches user_id to sessions/organizations/payments/idempotency. Existing accounts/data are assigned to the initial user, with a SQLite backup before migrating a version 1 database.
- The backend scopes all CRUD/filter/search/pagination/summary/idempotency operations to the session user_id; composite foreign keys block links to another account's organization. Switching accounts revokes the browser's previous session.
- Whole-database backup is restricted to the initial administrator in both UI and backend; CLI backup/restore is intended for server operators.
- 38/38 backend tests passed, covering legacy data/session migration, multiple accounts, cross-account ID access, account-scoped idempotency, and registration race/duplicate/rate-limit cases. Typecheck/lint/build passed. Six desktop/mobile header/registration UI tests passed on the development server with isolated endpoints.
- Added real E2E coverage: register A/B, create A's payment, verify B has no access to A's data, then return to A and confirm its data remains. A temporary backend avoided writing to the real database while development ports were occupied.
- Final multiple-account results: 38 backend tests and typecheck/lint/build passed; 6 desktop/mobile header/registration UI tests passed; 2 real A/B E2E tests against temporary SQLite passed (46.7 seconds). The temporary backend on port 18100 was stopped, and the user's development server was preserved.

## Update — 4 November 2026: Report Charts

- Added ReportCharts to /reports above the reconciliation tables: Paid/Unpaid bars by month or quarter, an optional total line, a value-share donut, and horizontal unpaid bars by organization.
- Used only the WebSocket report.summary response, with the same filters and account scope as the tables. No overdue/pending statuses or hardcoded growth figures were added.
- Used SVG/CSS Modules without new dependencies, supporting keyboard focus, per-period amount readouts, accessible chart names, and horizontal scrolling on small screens.
- 4/4 desktop/mobile Playwright tests passed (17.6s), covering quarter aggregation, percentages, rankings, filters, empty states, and zero-value payments. Sample data existed only in fixtures; real databases were not modified. Desktop/mobile runtime screenshots were inspected.
- Final production build, lint, and typecheck passed.

## Organizations Page Update — 4 November 2026

- Expanded only organization details and direct dependencies. The table follows Organization Name / Type / Representative / Contact Information / Address / Notes / Status / Actions. Existing layout, font, and palette were retained; new CSS applies only to the organization table.
- Add/edit forms and detail views gained type, representative, email, phone number, address, and ACTIVE/INACTIVE status. Email/phone use mailto/tel links; statuses display Active/Inactive.
- Migration 003 adds columns with safe defaults without changing existing names/notes/versions/ownership/payments. The backend validates lengths/email/phone/status and stores/returns the new fields through existing organization actions.
- Statistics queries received only p.status/p.amount prefixes to avoid ambiguous names now that organizations also have a status column; formulas and other pages' behavior were preserved.
- 50/50 backend tests passed; 2/2 desktop/mobile UI tests passed for column order, create/edit/view, clearing contact details, and reload. UI fixtures were isolated, and backend tests used temporary databases. Typecheck/lint/production build passed. Actual table screenshots were inspected; Reports/Payments/Header interfaces were not changed.

## Report Filters and Metrics Update — 4 November 2026

- Removed the organization/status/start-date/end-date/reset controls from Reports. Replaced three cards with Total Contract Revenue / Total Payments Received / Outstanding Balance / Receivables Collection Rate (received divided by total, or 0% when total is zero).
- Placed Year / Partner / Time Range filters below the four metrics. Full Year and By Quarter use the selected full year; By Quarter synchronizes the chart's quarter aggregation. Last 6 Months covers six months through today for the current year, or July–December for another year. The actual date range appears below the filters.
- The Export Report button downloads an Excel-compatible UTF-8 CSV with BOM, containing metrics and partner/month or quarter reconciliation for the selected filters. It is disabled while loading or when filters do not match the loaded data.
- The read-only report.years action retrieves years containing the authenticated account's payments. No schema or stored data changes were made; existing tables/chart styling were retained, and other pages kept their previous filters/metrics.
- 51/51 backend tests passed, including distinct/sorted years and account isolation. Typecheck/lint/production build passed; 8/8 desktop/mobile Playwright tests passed for filters, quarter grouping, CSV export, empty data, zero totals, and a six-month range crossing New Year. UI tests used isolated fixtures; backend tests used temporary databases.
