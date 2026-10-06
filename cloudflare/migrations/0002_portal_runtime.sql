CREATE TABLE IF NOT EXISTS portal_audit (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS portal_rate_limits (
 key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON portal_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_flows_expiry ON portal_auth_flows(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_record ON portal_audit(record_id);
