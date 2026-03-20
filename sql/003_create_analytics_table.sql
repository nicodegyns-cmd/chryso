-- 003_create_analytics_table.sql
-- Table pour stocker les analytiques (préférer JSON pour `distribution` si MySQL >= 5.7)

CREATE TABLE IF NOT EXISTS `analytics` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `analytic_type` VARCHAR(32) NOT NULL DEFAULT 'PDF',
  `code` VARCHAR(100) NOT NULL UNIQUE,
  `entite` VARCHAR(100) DEFAULT NULL,
  `distribution` JSON DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_code` (`code`),
  INDEX `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exemple d'insertion (utiliser JSON_ARRAY pour `distribution`):
-- INSERT INTO analytics (name, analytic_type, code, entite, distribution, description)
-- VALUES ('Rapport mensuel', 'PDF', 'RPT-M-001', '787', JSON_ARRAY('ops@example.com','finance@example.com'), 'Rapport généré chaque mois');
