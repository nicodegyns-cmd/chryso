-- 004_create_prestations_table.sql
-- Table to store prestation requests from personnel

CREATE TABLE IF NOT EXISTS `prestations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED DEFAULT NULL,
  `analytic_id` BIGINT UNSIGNED DEFAULT NULL,
  `date` DATE DEFAULT NULL,
  `pay_type` VARCHAR(100) DEFAULT NULL,
  `hours_actual` DECIMAL(6,2) DEFAULT NULL,
  `garde_hours` DECIMAL(6,2) DEFAULT NULL,
  `sortie_hours` DECIMAL(6,2) DEFAULT NULL,
  `overtime_hours` DECIMAL(6,2) DEFAULT NULL,
  `remuneration_infi` DECIMAL(10,2) DEFAULT NULL,
  `remuneration_med` DECIMAL(10,2) DEFAULT NULL,
  `comments` TEXT DEFAULT NULL,
  `proof_image` LONGTEXT DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'En attente',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user` (`user_id`),
  INDEX `idx_analytic` (`analytic_id`),
  INDEX `idx_date` (`date`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example insert (for testing):
-- INSERT INTO prestations (user_id, analytic_id, date, pay_type, hours_actual, remuneration_infi, remuneration_med, status)
-- VALUES (1, NULL, '2026-03-10', 'Garde', 8, 45.00, 120.00, 'En attente');
