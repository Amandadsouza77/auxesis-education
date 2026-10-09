CREATE TABLE IF NOT EXISTS migration_oauth_flows(state_hash TEXT PRIMARY KEY,nonce_hash TEXT NOT NULL,payload TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS migration_google_authorization(id TEXT PRIMARY KEY,email TEXT NOT NULL,refresh_token_ciphertext TEXT NOT NULL,scopes TEXT NOT NULL,client_id TEXT NOT NULL,updated_at TEXT NOT NULL);
