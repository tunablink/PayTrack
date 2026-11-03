CREATE TABLE owner (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE login_attempts (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE organizations (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000), version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE payments (
 id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 500),
 quantity TEXT NOT NULL CHECK(CAST(quantity AS NUMERIC)>0 AND CAST(quantity AS NUMERIC)<=1000000), unit_price INTEGER NOT NULL CHECK(unit_price BETWEEN 0 AND 1000000000000),
 amount INTEGER NOT NULL CHECK(amount BETWEEN 0 AND 1000000000000000), work_date TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('UNPAID','PAID')), version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX payments_organization_date ON payments(organization_id,work_date);
CREATE INDEX payments_status_date ON payments(status,work_date);
CREATE TABLE idempotency (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL);
