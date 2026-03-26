-- Create documents table for RIB uploads
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'PDF',
  file_path VARCHAR(1024) NOT NULL,
  file_size BIGINT NOT NULL,
  validation_status VARCHAR(50) DEFAULT 'pending',
  validated_at TIMESTAMP NULL,
  validated_by_id BIGINT NULL,
  rejection_reason VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_validation_status (validation_status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
