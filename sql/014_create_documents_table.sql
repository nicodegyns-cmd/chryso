-- Migration: Create documents table for storing generated documents
-- For user document management and sharing

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'PDF', -- PDF, CSV, etc.
  url TEXT DEFAULT NULL, -- URL to download the document
  file_path VARCHAR(512) DEFAULT NULL, -- Local file path if stored on disk
  file_size BIGINT DEFAULT NULL, -- File size in bytes
  description TEXT DEFAULT NULL,
  is_public SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_documents_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
