-- Migration: Add validation status to documents table
-- For RIB and document approval workflow

ALTER TABLE documents ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'approved', 'rejected'
ALTER TABLE documents ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP DEFAULT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS validated_by_id BIGINT DEFAULT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_validation_status ON documents(validation_status);
CREATE INDEX IF NOT EXISTS idx_validated_at ON documents(validated_at);
