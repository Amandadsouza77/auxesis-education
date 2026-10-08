CREATE TABLE IF NOT EXISTS portal_sync_locks (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_sync_preconditions (
 operation_id TEXT NOT NULL, record_id TEXT NOT NULL, expected_revision INTEGER NOT NULL,
 PRIMARY KEY(operation_id,record_id)
);
CREATE TRIGGER IF NOT EXISTS portal_sync_revision_guard
BEFORE INSERT ON portal_sync_preconditions
WHEN (NEW.expected_revision=0 AND EXISTS(SELECT 1 FROM portal_records WHERE id=NEW.record_id))
 OR (NEW.expected_revision>0 AND NOT EXISTS(SELECT 1 FROM portal_records WHERE id=NEW.record_id AND revision=NEW.expected_revision))
BEGIN SELECT RAISE(ABORT,'Production records changed; preview again.'); END;
