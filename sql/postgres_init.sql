-- PostgreSQL Migration for Chryso
-- Complete schema setup from all migration files
-- Converted from MySQL to PostgreSQL syntax

-- ============================================
-- 1. Create users table (from 001_create_users_table.sql)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) DEFAULT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  first_name VARCHAR(120) DEFAULT NULL,
  last_name VARCHAR(120) DEFAULT NULL,
  ninami VARCHAR(64) DEFAULT NULL,
  telephone VARCHAR(32) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  niss VARCHAR(64) DEFAULT NULL,
  bce VARCHAR(64) DEFAULT NULL,
  company VARCHAR(255) DEFAULT NULL,
  account VARCHAR(255) DEFAULT NULL,
  fonction VARCHAR(255) DEFAULT NULL,
  
  -- From 002_migrate_liaison_column.sql: liaison_ebrigade_id (migrated from liaison_eve_id)
  liaison_ebrigade_id VARCHAR(100) DEFAULT NULL,
  
  -- From 006_add_ebrigade_id_to_users.sql
  ebrigade_id VARCHAR(255) DEFAULT NULL UNIQUE,
  
  password_reset_token VARCHAR(128) DEFAULT NULL,
  password_reset_sent_at TIMESTAMP DEFAULT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_liaison_ebrigade ON users(liaison_ebrigade_id);
CREATE INDEX IF NOT EXISTS idx_users_ebrigade ON users(ebrigade_id);

-- ============================================
-- 2. Create roles table (from 008_create_roles_table.sql)
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard roles (from 008_create_roles_table.sql)
INSERT INTO roles (code, label) VALUES
  ('INFI', 'Infirmier / Infirmière'),
  ('MED', 'Médecin'),
  ('admin', 'Administrateur'),
  ('moderator', 'Modérateur')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 3. Create analytics table (from 003_create_analytics_table.sql)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  analytic_type VARCHAR(32) NOT NULL DEFAULT 'PDF',
  code VARCHAR(100),
  entite VARCHAR(100) DEFAULT NULL,
  distribution JSON DEFAULT NULL,
  description TEXT DEFAULT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by BIGINT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_code ON analytics(code);
CREATE INDEX IF NOT EXISTS idx_active ON analytics(is_active);

-- ============================================
-- 4. Create activities table (from 004_create_activities_table.sql)
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
  id BIGSERIAL PRIMARY KEY,
  analytic_id BIGINT DEFAULT NULL,
  analytic_name VARCHAR(255) DEFAULT NULL,
  analytic_code VARCHAR(100) DEFAULT NULL,
  pay_type VARCHAR(50) DEFAULT NULL,
  date DATE DEFAULT NULL,
  
  -- From 005_alter_activities_add_remuneration.sql
  remuneration_infi DECIMAL(10, 2) DEFAULT NULL,
  remuneration_med DECIMAL(10, 2) DEFAULT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_activities_analytics FOREIGN KEY (analytic_id) REFERENCES analytics(id) ON DELETE SET NULL
);

-- Create indexes for activities
CREATE INDEX IF NOT EXISTS idx_analytic ON activities(analytic_id);

-- ============================================
-- 5. Create pdf_sends table (from 009_create_pdf_sends_table.sql)
-- ============================================
CREATE TABLE IF NOT EXISTS pdf_sends (
  id SERIAL PRIMARY KEY,
  analytic_id INT,
  analytic_code VARCHAR(255),
  analytic_name VARCHAR(255),
  recipient_emails TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_by VARCHAR(255),
  prestation_count INT DEFAULT 0,
  first_prestation_date DATE,
  last_prestation_date DATE,
  filename VARCHAR(512),
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. Create prestations table (from 004_create_prestations_table.sql + modifications)
-- ============================================
CREATE TABLE IF NOT EXISTS prestations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT DEFAULT NULL,
  analytic_id BIGINT DEFAULT NULL,
  date DATE DEFAULT NULL,
  pay_type VARCHAR(100) DEFAULT NULL,
  
  -- Hours
  hours_actual DECIMAL(6, 2) DEFAULT NULL,
  garde_hours DECIMAL(6, 2) DEFAULT NULL,
  sortie_hours DECIMAL(6, 2) DEFAULT NULL,
  overtime_hours DECIMAL(6, 2) DEFAULT NULL,
  
  -- Remuneration
  remuneration_infi DECIMAL(10, 2) DEFAULT NULL,
  remuneration_med DECIMAL(10, 2) DEFAULT NULL,
  
  -- Comments and images
  comments TEXT DEFAULT NULL,
  proof_image TEXT DEFAULT NULL,
  
  -- Status and management
  status VARCHAR(50) NOT NULL DEFAULT 'En attente',
  
  -- From 005_add_expense_columns_to_prestations.sql
  expense_amount DECIMAL(10, 2) DEFAULT NULL,
  expense_comment TEXT DEFAULT NULL,
  
  -- From 006_alter_prestations_add_activity_id.sql
  activity_id BIGINT DEFAULT NULL,
  
  -- From 010_add_sent_in_batch_to_prestations.sql
  sent_in_batch_id INT DEFAULT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_prestations_analytics FOREIGN KEY (analytic_id) REFERENCES analytics(id),
  CONSTRAINT fk_prestations_activities FOREIGN KEY (activity_id) REFERENCES activities(id),
  CONSTRAINT fk_prestations_pdf_sends FOREIGN KEY (sent_in_batch_id) REFERENCES pdf_sends(id) ON DELETE SET NULL
);

-- Create indexes for prestations
CREATE INDEX IF NOT EXISTS idx_user ON prestations(user_id);
CREATE INDEX IF NOT EXISTS idx_analytic ON prestations(analytic_id);
CREATE INDEX IF NOT EXISTS idx_date ON prestations(date);
CREATE INDEX IF NOT EXISTS idx_status ON prestations(status);
CREATE INDEX IF NOT EXISTS idx_activity_id ON prestations(activity_id);

-- ============================================
-- 7. Update roles (from 007_update_users_role_user_to_infi.sql)
-- This is a data migration - update users with role='user' to 'INFI'
-- Note: This is safe to run idempotently
-- ============================================
UPDATE users SET role = 'INFI' WHERE role = 'user';
