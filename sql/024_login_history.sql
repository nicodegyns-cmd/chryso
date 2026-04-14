-- 024_login_history.sql
-- Historique des connexions

CREATE TABLE IF NOT EXISTS login_history (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT,
  email       VARCHAR(254) NOT NULL,
  first_name  VARCHAR(100),
  last_name   VARCHAR(100),
  role        VARCHAR(100),
  ip_address  VARCHAR(64),
  user_agent  TEXT,
  logged_in_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_logged_in_at ON login_history(logged_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
