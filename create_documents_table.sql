-- Create documents table for RIB uploads (Postgres compatible)
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'PDF',
  file_path VARCHAR(1024) NOT NULL,
  file_size BIGINT NOT NULL,
  validation_status VARCHAR(50) DEFAULT 'pending',
  validated_at TIMESTAMP DEFAULT NULL,
  validated_by_id BIGINT DEFAULT NULL,
  rejection_reason VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_status ON documents(validation_status);
CREATE INDEX IF NOT EXISTS idx_created_at ON documents(created_at);
