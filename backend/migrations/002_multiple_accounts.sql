CREATE TABLE users (
 id INTEGER PRIMARY KEY,
 username TEXT NOT NULL UNIQUE CHECK(length(trim(username)) BETWEEN 1 AND 100),
 password_hash TEXT NOT NULL,
 is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0,1))
);
INSERT INTO users(id,username,password_hash,is_admin) SELECT id,username,password_hash,1 FROM owner;

CREATE TABLE sessions_v2 (
 token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO sessions_v2 SELECT token_hash,expires,1 FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_v2 RENAME TO sessions;
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE organizations_v2 (
 id INTEGER PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000), version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 UNIQUE(id,user_id)
);
INSERT INTO organizations_v2 SELECT id,name,notes,version,created_at,updated_at,1 FROM organizations;
CREATE TABLE payments_v2 (
 id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL,
 description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 500),
 quantity TEXT NOT NULL CHECK(CAST(quantity AS NUMERIC)>0 AND CAST(quantity AS NUMERIC)<=1000000),
 unit_price INTEGER NOT NULL CHECK(unit_price BETWEEN 0 AND 1000000000000),
 amount INTEGER NOT NULL CHECK(amount BETWEEN 0 AND 1000000000000000),
 work_date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('UNPAID','PAID')),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY(organization_id,user_id) REFERENCES organizations_v2(id,user_id) ON DELETE RESTRICT
);
INSERT INTO payments_v2 SELECT id,organization_id,description,quantity,unit_price,amount,work_date,status,version,created_at,updated_at,1 FROM payments;
DROP TABLE payments;
DROP TABLE organizations;
ALTER TABLE organizations_v2 RENAME TO organizations;
ALTER TABLE payments_v2 RENAME TO payments;
CREATE INDEX organizations_user ON organizations(user_id,name);
CREATE INDEX payments_user_date ON payments(user_id,work_date);
CREATE INDEX payments_organization_date ON payments(user_id,organization_id,work_date);
CREATE INDEX payments_status_date ON payments(user_id,status,work_date);

CREATE TABLE idempotency_v2 (
 key TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,key)
);
INSERT INTO idempotency_v2 SELECT key,fingerprint,result,created_at,1 FROM idempotency;
DROP TABLE idempotency;
ALTER TABLE idempotency_v2 RENAME TO idempotency;
CREATE TABLE registration_attempts (ip TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
DROP TABLE owner;
