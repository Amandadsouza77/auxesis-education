ALTER TABLE portal_auth_flows ADD COLUMN payload TEXT;
CREATE TABLE IF NOT EXISTS portal_operations (
 account_id TEXT NOT NULL, operation_id TEXT NOT NULL, result TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(account_id, operation_id)
);
CREATE INDEX IF NOT EXISTS idx_operations_created ON portal_operations(created_at);
