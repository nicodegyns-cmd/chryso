-- Migration: Create invoices table for billing management
-- 2024-03-26

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'overdue', 'cancelled'
  due_date DATETIME,
  paid_date DATETIME,
  payment_method VARCHAR(50), -- 'bank_transfer', 'cash', 'check', etc.
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT,
  KEY idx_status (status),
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at),
  KEY idx_due_date (due_date),
  KEY idx_invoice_user_status (user_id, status),
  KEY idx_invoice_period (created_at, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
