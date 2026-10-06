-- Cloudflare D1 replacement for Floot portal persistence.
-- Portal-specific state only: Calendar and Student Tracker remain authoritative.
CREATE TABLE IF NOT EXISTS portal_accounts (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL,
 parent_id TEXT, student_id TEXT, enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS portal_sessions (
 token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, expires_at TEXT NOT NULL,
 FOREIGN KEY(account_id) REFERENCES portal_accounts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS portal_auth_flows (
 token_hash TEXT PRIMARY KEY, phase TEXT NOT NULL, account_id TEXT, nonce_hash TEXT,
 expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_records (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, student_id TEXT, parent_id TEXT,
 data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portal_records_kind ON portal_records(kind);
CREATE INDEX IF NOT EXISTS idx_portal_records_student ON portal_records(student_id);
CREATE INDEX IF NOT EXISTS idx_portal_records_parent ON portal_records(parent_id);
CREATE TABLE IF NOT EXISTS google_connections (
 account_id TEXT PRIMARY KEY, email TEXT NOT NULL, refresh_token_ciphertext TEXT NOT NULL,
 scopes TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(account_id) REFERENCES portal_accounts(id) ON DELETE CASCADE
);
