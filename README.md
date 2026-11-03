# Personal Payment Tracking System — Next.js, Python and VPS

> **Project status:** Planning and design. This document describes the revised proposed architecture, not completed or tested functionality.
>
> **Infrastructure clarification:** Use a **VPS (Virtual Private Server) / cloud virtual server with administrator control**, not shared hosting and not ESP32. The provider and server size remain to be selected.

## 1. Project Information

| Information | Description |
| --- | --- |
| Project Name | Personal Payment Tracking System |
| Group | 12 |
| Course | Java Software Development (original course designation; confirm approval of non-Java stack) |
| Academic Year | 2026–2027 |
| Instructor | Ngô Văn Quyền|
| Members | 2301040089 Ngô Thị Thanh Hương 2301040012 Tống Phương Anh 2301040102 Nguyễn Thị Thuỳ Linh 2301040206 Lê Thị Hải Yến 2301040208 Nguyễn Thị Hoàng Yến |
| Project Direction | Web application: Next.js + Tailwind CSS frontend; Python backend; socket-based networking; VPS deployment |
| Current Stage | Requirements analysis and architecture planning |

### Proposed Team Responsibilities

| Role | Main Responsibility |
| --- | --- |
| 2301040208 Nguyễn Thị Hoàng Yến | Requirements, documentation and testing |
| 2301040012 Tống Phương Anh | Next.js pages, Tailwind styling and client state |
| 2301040089 Ngô Thị Thanh Hương | Python services, validation and business rules |
| 2301040206 Lê Thị Hải Yến | Socket networking, multithreading and metaprogramming |
| 2301040102 Nguyễn Thị Thuỳ Linh | SQLite, VPS deployment, integration and testing |

## 2. Project Overview

### 2.1. Problem and Motivation

An individual may work for several organizations (for example, a lecturer teaching, marking examinations or supervising students at different universities). Each organization owes different amounts for different activities. Informal tracking makes it difficult to determine what work is complete, how much money is expected, what has been paid and what remains outstanding.

The system provides a lightweight browser-based tool for tracking work-related receivables rather than a full accounting platform. The revised implementation also demonstrates Python networking, concurrency and metaprogramming in a practical client–server system.

### 2.2. Objectives

1. Maintain organizations that owe the user money.
2. Record work descriptions, quantities, unit prices, dates and calculated amounts.
3. Mark receivables as **PAID** or **UNPAID**.
4. Display totals, filtering and summaries by organization or period.
5. Build the web frontend with **Next.js, TypeScript and Tailwind CSS**.
6. Build the backend with **Python and FastAPI**, using **WebSocket (a socket-based, TCP-backed protocol)** for application messages.
7. Deploy the application and database on a **VPS** and demonstrate meaningful **Networking, Multithreading and Metaprogramming**.

### 2.3. Scope

**In scope (planned):** Single-person use; organization CRUD; receivable CRUD; paid/unpaid status; searching/filtering; dashboard summaries; reporting; browser-to-server WebSocket communication; SQLite persistence; network error handling; VPS deployment.

**Out of scope (initial release):** Bank integration, automatic transfers, payroll/tax accounting, AI forecasting, complex multi-user roles and advanced accounting. Partial payments, import/export and authentication beyond a minimal secure deployment are possible follow-ups, subject to project requirements.

### 2.4. Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | Create, view, edit and delete organizations | Must |
| FR-02 | Create, view, edit and delete receivables | Must |
| FR-03 | Record organization, work description, quantity, unit price, amount and relevant dates | Must |
| FR-04 | Change status between PAID and UNPAID | Must |
| FR-05 | Show total expected, total paid and total unpaid | Must |
| FR-06 | Filter records by organization, status and period | Should |
| FR-07 | Exchange structured messages over a WebSocket connection | Must |
| FR-08 | Show meaningful validation, disconnection and server errors | Must |
| FR-09 | Import/export or backup data | Could |

### 2.5. Non-Functional Requirements

- **Usability:** Responsive browser pages with clear forms, tables and payment indicators.
- **Responsiveness:** Keep slow I/O and background work from blocking requests or the browser.
- **Correctness:** Reject invalid quantities/prices; use integer VND or Decimal for money.
- **Reliability:** Handle socket disconnections, retries and failed updates without false success.
- **Maintainability:** Separate presentation, business logic, transport and persistence.
- **Security:** Use HTTPS/WSS, validate all messages, protect the database and require appropriate authentication before public access.
- **Portability:** Document Python/Node versions, container configuration and VPS setup.

## 3. Main Features

### 3.1. Organization Management

Manage organizations such as universities or companies, including ID, name and optional notes; support add, list, edit and delete operations.

### 3.2. Receivable Management

Record organization, work description, quantity, unit price, calculated amount, work date and PAID/UNPAID status. Support create/read/update/delete, input validation, search and filters.

**Illustrative example (not actual project data):**

| Organization | Work | Quantity | Unit Price | Amount | Status |
| --- | --- | ---: | ---: | ---: | --- |
| University A | Teaching | 20 | 200,000 VND | 4,000,000 VND | PAID |
| University B | Exam marking | 50 | 30,000 VND | 1,500,000 VND | UNPAID |
| University C | Supervision | 5 | 500,000 VND | 2,500,000 VND | PAID |
| University A | Invigilation | 4 | 300,000 VND | 1,200,000 VND | UNPAID |

For this example only: **Total 9,200,000 VND; paid 6,500,000 VND; unpaid 2,700,000 VND.**

### 3.3. Dashboard and Reporting

Display aggregate expected/paid/unpaid totals, counts of paid/unpaid records and breakdowns by organization or time period. These are receivable statistics, not bank-account balances.

### 3.4. Networking and Connection Status

Connect the browser to the Python backend using WebSocket; show connection state, loading/processing state, server-side validation errors and reconnect feedback.

### 3.5. Proposed Page Structure (derived from the feature scope)

| Page / view | Features |
| --- | --- |
| **Dashboard** (`/dashboard`) | Total expected, total paid, total unpaid; paid/unpaid record counts; high-level summaries by organization or period |
| **Organizations** (`/organizations`) | Organization list; add/edit/delete organizations; organization name and optional notes |
| **Receivables / Payment Management** (`/payments`) | Receivable list; create/edit/delete; organization, description, quantity, unit price, computed amount, work date; mark PAID/UNPAID; search/filter by organization, status and period |
| **Reports / Statistics** (`/reports`) | Breakdown by organization and time period; paid/unpaid counts and totals; charts/tables as presentation choices |

**Shared interface elements, not necessarily separate pages:** connection status/error notifications, create/edit dialogs and form validation. A dedicated Settings, Login or Import/Export page is **not** specified as a core page in the original requirements. The routes above are proposed names, not implemented routes.

## 4. System Architecture

### 4.1. Proposed Architecture

```text
Browser
  Next.js + TypeScript + Tailwind CSS
  Pages / Forms / Charts / WebSocket Client
                 |
                 | WSS (WebSocket over TLS, TCP/IP)
                 v
VPS / Cloud Virtual Server (Linux)
  Reverse Proxy (Nginx or Caddy: TLS and WebSocket upgrade)
                 |
                 v
  Python FastAPI / ASGI application
    WebSocket endpoint and JSON message dispatcher
    Validation / Services / Reporting
    ThreadPoolExecutor for selected blocking I/O tasks
    Decorator-based authorization / logging
    Reflection-based handler registry
                 |
                 v
  SQLite (persistent storage)
```

**Deployment model:** The VPS runs the server processes; it is not the user's development PC. Docker Compose runs frontend, backend and reverse-proxy services on the VPS. SQLite is an embedded database accessed only by the backend; no separate database server or container is required. Mount the entire SQLite data directory as a persistent volume. A VPS gives control over processes and ports, unlike typical shared hosting.

**Socket terminology:** For a browser frontend, use **WebSocket**, which provides persistent bidirectional socket-based communication over TCP. A browser cannot directly open an arbitrary raw TCP socket. If the instructor specifically requires a raw TCP socket (`socket.socket`), confirm whether a separate Python-to-Python TCP demonstration/service is required; do not label WebSocket as raw TCP.

### 4.2. Responsibilities

| Component | Responsibilities |
| --- | --- |
| Next.js pages/components | Render pages, forms, tables and charts; display server-confirmed state |
| WebSocket client | Establish WSS connection, send messages with request IDs, receive responses, reconnect safely |
| FastAPI WebSocket endpoint | Accept connections, parse messages, dispatch actions, return structured responses |
| Python services | Validation, monetary calculations, organization/payment operations and reporting |
| Thread pool / workers | Run selected blocking tasks without blocking the async event loop; handle safe concurrent work |
| Decorators / reflection registry | Cross-cutting logging/authorization/validation and dynamic dispatch of action handlers |
| SQLite repository | Store and query organizations and receivables using parameterized access / ORM |
| Reverse proxy + VPS | TLS termination, routing, deployment and server process management |

### 4.3. Example Request Flow

1. The user selects **Mark as paid** on the Receivables page.
2. Next.js sends a WebSocket JSON message containing `requestId`, action and payment ID.
3. FastAPI validates the message and dispatches it to the corresponding Python service.
4. The service updates SQLite safely and returns the committed result.
5. The server sends a response with the matching `requestId`.
6. The browser updates the displayed status and dashboard data only after confirmed success; otherwise it shows an error.

### 4.4. Preliminary WebSocket Message Contract

**Proposed endpoint:** `wss://<your-domain>/ws` (placeholder; not a deployed address).

**Client request example:**

```json
{
  "requestId": "req-104",
  "action": "payment.updateStatus",
  "payload": { "paymentId": 12, "status": "PAID" }
}
```

**Server success response example:**

```json
{
  "requestId": "req-104",
  "success": true,
  "data": { "paymentId": 12, "status": "PAID" }
}
```

**Server error response example:**

```json
{
  "requestId": "req-104",
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid payment status" }
}
```

**Planned action groups:** `organization.list/create/update/delete`, `payment.list/create/update/delete/updateStatus`, `dashboard.summary`, `report.byOrganization`, `report.byPeriod`, `system.ping`.

Message validation, authorization, correlation IDs, timeout policy, duplicate-write prevention and database transactions must be implemented and tested. This is a proposed protocol, not a running endpoint.

## 5. Python Application Design

### 5.1. Proposed Modules

| Module / class | Responsibility |
| --- | --- |
| `main.py` | FastAPI application and startup configuration |
| `ws_endpoint.py` | WebSocket lifecycle, connection handling |
| `message_dispatcher.py` | Route validated actions to registered handlers |
| `models.py` / `schemas.py` | Database models and Pydantic request/response schemas |
| `payment_service.py` | Payment validation, calculation and status updates |
| `organization_service.py` | Organization operations |
| `dashboard_service.py` | Aggregation and reporting |
| `repositories/` | SQLite data access |
| `decorators.py` | Reusable logging, authorization and timing decorators |
| `handler_registry.py` | Reflection-driven action registration/dispatch |
| `task_executor.py` | Thread pool for selected blocking tasks |

### 5.2. Design Principles

- Encapsulation and separation of concerns between transport, services and persistence.
- Service Layer and Repository patterns for maintainability and testability.
- Dependency injection using FastAPI dependencies or explicit constructor injection.
- Centralized input validation and consistent error responses.
- Avoid floating-point money calculations; use `Decimal` or integer VND.

## 6. Technical Implementation: Required Concepts

> All techniques below are **planned applications**, not claims that code already exists. Demonstrate each with actual code, test cases and evidence in the final report.

### 6.1. Networking — WebSocket over TCP/IP

**Where used:** Browser ↔ Python backend on VPS.

- Next.js establishes a secure `wss://` WebSocket connection to FastAPI.
- The backend receives and responds to JSON messages with `requestId`, `action` and `payload`.
- Support multiple connected browsers/sessions, heartbeat or ping, disconnection detection, bounded reconnect and clear errors.
- Validate every message server-side and use authentication/authorization for any Internet-facing deployment.
- Use Python's `asyncio`/ASGI socket handling; the underlying network transport is TCP/IP. `asyncio` concurrency is not, by itself, multithreading.

**Evidence to include:** Connection logs, request/response examples, reconnect test, invalid-message test and concurrent-client test.

### 6.2. Multithreading — Python `threading` / `ThreadPoolExecutor`

**Where used:** Selected blocking background tasks, such as generating a report or processing a file export while the server continues serving other clients.

- Create a bounded `concurrent.futures.ThreadPoolExecutor` for demonstrable blocking I/O work.
- Submit tasks and collect results/failures without blocking the FastAPI event loop.
- Avoid sharing mutable state without synchronization; use `threading.Lock` only when a genuine shared in-memory resource requires it.
- Use database transactions for data consistency; a Python lock alone does not protect multiple server processes.
- Shut down the executor cleanly and test concurrent requests.
- Do **not** claim async WebSocket handlers alone satisfy a multithreading requirement. CPython's GIL limits CPU-bound speedups in typical configurations.

**Evidence to include:** Thread names/IDs in logs, parallel blocking-I/O task test, server responsiveness under load and safe error handling.

### 6.3. Metaprogramming — Decorators and Reflection

**Where used:** Reusable action handling and cross-cutting backend behavior.

- **Decorators:** Implement `@require_permission`, `@log_action` or `@measure_time` to wrap WebSocket action handlers. Check permissions against actual authenticated identity, not untrusted payload fields.
- **Reflection:** Use `inspect.signature`, `getattr` or inspection of registered callables to validate handler metadata and build a controlled action registry.
- **Dynamic handler registration:** A decorator such as `@socket_action("payment.updateStatus")` registers a callable into a whitelist-based dispatcher, avoiding a long hard-coded conditional chain.
- Keep the registry explicit and restricted; **never** dynamically execute arbitrary action names, import paths or user-supplied code.
- Metaclasses are optional and not necessary unless they solve a documented problem.

**Evidence to include:** Decorator/registry implementation, a new action added without modifying the dispatcher, authorization tests and reflection/registration tests.

### 6.4. Database and I/O

- **SQLite** is the proposed persistent database on the VPS.
- Python access through the built-in `sqlite3` module, with parameterized queries, short transactions and an independent connection per task. Enable foreign keys on every connection, WAL mode and a busy timeout; begin with one backend process.
- JSON encoding/decoding for WebSocket messages.
- Optional file I/O for exports/backups if implemented.
- Configure the private data directory through `DATA_DIR`. Keep the SQLite database, WAL files, backups and application secrets outside public assets and out of Git. Use the SQLite backup API for consistent backups.

### 6.5. Frontend Technology (not a GUI-course requirement)

- Next.js + TypeScript for browser pages, routing and client state.
- Tailwind CSS for consistent responsive styling.
- Tables, forms, status indicators and charts support the domain features.
- This replaces the old JavaFX implementation; there is **no JavaFX/FXML GUI requirement** in the revised technical scope.

## 7. Proposed Repository Structure

```text
project/
├── frontend/                     # Next.js + TypeScript + Tailwind CSS
│   ├── app/
│   │   ├── dashboard/
│   │   ├── organizations/
│   │   ├── payments/
│   │   └── reports/
│   ├── components/
│   ├── lib/websocket/
│   └── package.json
├── backend/                      # Python + FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── networking/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── metaprogramming/
│   │   ├── concurrency/
│   │   ├── models/
│   │   └── schemas/
│   ├── tests/
│   └── requirements.txt          # or pyproject.toml
├── deploy/
│   ├── compose.yaml
│   └── reverse-proxy/
├── docs/
├── sample-data/
├── report/
└── README.md
```

## 8. Requirements and Hosting

| Item | Proposed choice / status |
| --- | --- |
| Frontend | Next.js, TypeScript, Tailwind CSS; pin versions during implementation |
| Backend | Python 3.x, FastAPI, Uvicorn; pin versions |
| Socket protocol | WebSocket (`wss://`) for browser ↔ backend |
| Database | SQLite |
| Multithreading | Python `ThreadPoolExecutor`, `threading` where needed |
| Metaprogramming | Python decorators, `inspect`, controlled dynamic handler registry |
| Testing | pytest, HTTP/WebSocket integration tests, Playwright optional |
| Deployment | Linux VPS / cloud virtual server with process and network control |
| Containers | Docker + Docker Compose (proposed) |
| Reverse proxy | Nginx or Caddy with TLS and WebSocket support |
| Hardware | Development computer; no ESP32 or dedicated embedded device required |

**Hosting clarification:** The chosen environment must allow long-running Python/ASGI services, WebSocket connections, database persistence, TLS and appropriate firewall configuration. This is why the plan specifies a **VPS**, not ordinary shared hosting.

## 9. Installation and Deployment Plan

> No runnable source code was supplied with the original README. The steps below are planned and must be verified after implementation.

1. Install Node.js and Python locally at the versions selected by the team.
2. Set up frontend dependencies and backend virtual environment/dependencies.
3. Configure `DATA_DIR` for SQLite storage and run database migrations; do not commit runtime data or secrets. When starting from `backend/`, the default database is `../data/tracker.sqlite3`.
4. Run local Next.js and FastAPI development servers; test WebSocket actions.
5. Provision a Linux VPS with SSH access and firewall rules.
6. Install Docker/Compose or the selected process supervisor on the VPS.
7. Deploy frontend, backend and reverse proxy; mount the SQLite data directory as a persistent volume and enable HTTPS/WSS.
8. Keep the SQLite file in a private backend-only directory outside source/public assets; do not expose it through static URLs or a network filesystem.
9. Test persistence, reconnect, backups and restart behavior.

## 10. Run and Demonstration

### 10.1. Local Development (illustrative)

```bash
# Frontend (after installing dependencies)
cd frontend
npm run dev

# Backend (separate terminal, after installing dependencies)
cd backend
uvicorn app.main:app --reload
```

Commands are illustrative and not verified against actual project files.

### 10.2. VPS Deployment (illustrative)

```bash
# From the directory containing the implemented Compose configuration
docker compose up -d --build
```

This requires actual Dockerfiles, Compose configuration, TLS and secrets management.

### 10.3. Expected Demo Workflow

1. Open the deployed website in a browser and establish a WebSocket connection.
2. Add an organization.
3. Create a receivable with quantity and unit price.
4. Observe the unpaid total on the dashboard.
5. Mark the receivable as paid; confirm that the server response precedes UI success.
6. Check reports and data persistence after a server restart.
7. Simulate a connection failure and show safe recovery.
8. Demonstrate concurrent background tasks and decorator-based message dispatch with logs/tests.

## 11. Testing

### 11.1. Test Environment

**Not yet established.** Record actual VPS specs, OS, Python/Node versions, database version, browser, test tools and test data size.

### 11.2. Planned Test Cases

| ID | Test Case | Expected Result | Status |
| --- | --- | --- | --- |
| TC01 | Add organization | Organization created and persisted | Planned |
| TC02 | Create receivable: 20 × 200,000 VND | Amount = 4,000,000 VND | Planned |
| TC03 | Invalid quantity: -1 | Validation error; no save | Planned |
| TC04 | Mark receivable paid | Status and totals update after confirmed success | Planned |
| TC05 | Aggregate four illustrative records | Total 9.2m; paid 6.5m; unpaid 2.7m VND | Planned |
| TC06 | Disconnect WebSocket | Clear connection error; no false save | Planned |
| TC07 | Delayed server response | Browser remains responsive | Planned |
| TC08 | Competing updates to one record | Consistent final stored state | Planned |
| TC09 | Restart application/recreate backend container | Committed data remains available | Planned |
| TC10 | Invalid WebSocket payload | Defined error; no corrupt record | Planned |
| TC11 | Multiple simultaneous WebSocket clients | Correct request IDs and isolated responses | Planned |
| TC12 | Parallel blocking-I/O tasks in thread pool | Concurrent execution with logged thread IDs | Planned |
| TC13 | Decorator-based action registry | Handler registered and invoked; unauthorized action rejected | Planned |
| TC14 | TLS/WSS and access control | Encrypted connection; protected operations require authorization | Planned |

### 11.3. Test Levels

- **Unit:** Calculation, validation, state transitions, reporting, decorators and dispatch registry.
- **Integration:** WebSocket message handling, Python services and SQLite.
- **System:** Complete organization → receivable → paid → report workflow.
- **Concurrency/network:** Simultaneous clients, thread pool, timeouts, reconnects and conflicting writes.
- **Deployment:** HTTPS/WSS, VPS restart and database persistence.

## 12. Experimental Evaluation

### 12.1. Proposed Experiments

1. **Multithreading:** Compare serial versus bounded-thread-pool execution of representative blocking-I/O tasks; record duration and thread IDs.
2. **Networking:** Measure WebSocket message round-trip latency for list/create/update operations.
3. **Concurrent clients:** Run multiple WebSocket connections and check correctness/error rates.
4. **Failure recovery:** Test disconnect, timeout, reconnect and restart behavior.
5. **Consistency:** Send repeated or competing updates and verify committed state.
6. **Metaprogramming:** Verify decorator interception and automatic action registration using unit tests.

### 12.2. Metrics

- End-to-end message latency (ms) and summary statistics.
- Task duration and throughput for serial versus thread-pool execution.
- Success/error counts and reconnect outcomes.
- Correctness of totals, state changes and persisted records.
- CPU/memory usage where measurable.

**No measurements have been provided. Do not present expected results as observed performance.**

## 13. Results

**Pending implementation and testing.** Add actual test logs, screenshots of implemented web pages, WebSocket traces, thread execution evidence, decorator/registry tests and measured tables/plots.

## 14. Novelty and Contributions

### 14.1. Proposed Baseline

Manual spreadsheet tracking or a simple single-request implementation is a possible comparison baseline; neither has been evaluated.

### 14.2. Proposed Group Contributions

1. A web-based personal receivable tracking system with Next.js and Python.
2. Socket-based, bidirectional browser–server communication using WebSocket over TCP/IP.
3. Explicit Python multithreading for selected blocking background tasks, with concurrency tests.
4. Decorator- and reflection-based handler registration and reusable authorization/logging behavior.
5. VPS deployment with SQLite persistence, secure transport and reproducible tests.

**These are intended contributions, not completed work.**

## 15. Code Review and Optimization

**No application source code has been reviewed.** Planned checklist:

- Separate frontend, transport, business rules and persistence.
- Avoid floating-point money arithmetic.
- Validate/authorize WebSocket actions on the server.
- Do not block the event loop with synchronous I/O.
- Bound thread-pool size; clean up threads and connections.
- Protect shared state and use database transactions for conflicting updates.
- Never expose SQLite files, backups, application secrets or arbitrary reflection targets to clients.
- Verify reverse-proxy WebSocket upgrade and TLS configuration.
- Record refactoring and measured optimization results.

## 16. Limitations

- A VPS requires server administration, monitoring, backups and security updates.
- WebSocket is a browser-compatible socket protocol, not a direct raw TCP socket API.
- Long-running socket connections need reconnect/heartbeat handling and may be interrupted by proxies.
- Typical CPython threading is most beneficial for blocking I/O, not CPU-heavy parallelism.
- Single-person workflows are prioritized; complex roles and simultaneous editing are not core business features.
- Offline editing and synchronization are not included initially.
- Changing from Java to Python/Next.js may require explicit instructor approval if the course rubric mandates Java technologies.

## 17. Future Work

Potential extensions: import/export and backup/restore; partial payments and history; richer monthly/yearly reporting; stronger multi-user permissions; offline synchronization; enhanced monitoring and recovery.

## 18. References

### Original course/project materials

1. `Topics.md` — Java Programming Project – Topics.
2. `Instructions.md` — Java Programming Project – Instructions.
3. `Rubric.md` — Java Programming Project – Assessment Rubric.
4. Original project README and its proposed receivable features.

### Official documentation for revised stack

- [Next.js](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
- [Python threading](https://docs.python.org/3/library/threading.html)
- [Python concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html)
- [Python inspect](https://docs.python.org/3/library/inspect.html)
- [SQLite](https://www.sqlite.org/docs.html)
- [Docker Compose](https://docs.docker.com/compose/)

Follow the course's attribution and AI-use rules.

## 19. Report

Proposed report path:

```text
report/GroupXX_PersonalPaymentTracking_Report.docx
```

The final report should cover requirements, architecture, WebSocket networking, multithreading, metaprogramming, persistence, deployment, tests, measurements, limitations and references. The original instructions specify Compilatio similarity **≤ 20%** and submission via the **LMS**; verify the latest instructor requirements.

## 20. Final Checklist

### Design and Implementation

- [ ] Confirm instructor approval for replacing Java/JavaFX with Next.js/Python.
- [ ] Confirm whether WebSocket meets the socket requirement or a raw TCP demo is required.
- [ ] Confirm VPS provider/specifications and authentication requirements.
- [ ] Fill in group, instructor and member information.
- [ ] Finalize page requirements, database schema and message contract.
- [ ] Implement Next.js frontend and Tailwind styles.
- [ ] Implement FastAPI WebSocket backend and SQLite persistence.
- [ ] Implement and document actual Python thread-pool tasks.
- [ ] Implement and document decorator/reflection-based handler dispatch.
- [ ] Deploy on VPS with TLS/WSS and secured database.
- [ ] Verify startup, reconnect, backups and failure handling.

### Testing and Submission

- [ ] Run unit, integration, system, socket and concurrency tests.
- [ ] Record measured results and code evidence for technical contributions.
- [ ] Complete code review and optimization.
- [ ] Provide runnable source and verified deployment instructions.
- [ ] Finish report, references and required similarity check.
- [ ] Submit through LMS according to instructor instructions.

## Decisions Awaiting Confirmation

| Question | Current Position |
| --- | --- |
| Hosting type | **VPS / cloud virtual server selected; provider pending** |
| Frontend stack | **Next.js + TypeScript + Tailwind CSS proposed** |
| Backend stack | **Python + FastAPI proposed** |
| Persistent storage | **SQLite proposed** |
| Browser socket protocol | **WebSocket over TCP/IP proposed** |
| Raw TCP socket required separately? | **Ask instructor** |
| Multithreading demonstration | **Python ThreadPoolExecutor for real blocking-I/O work** |
| Metaprogramming demonstration | **Decorators + reflection-based action registry** |
| Java/JavaFX mandatory under course rubric? | **Confirm instructor approval** |

*Update this decision log after instructor confirmation and implementation.*
