-- 004_create_activities_table.sql
-- Table pour stocker les activités liées aux analytiques

CREATE TABLE IF NOT EXISTS `activities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `analytic_id` BIGINT UNSIGNED DEFAULT NULL,
  `analytic_name` VARCHAR(255) DEFAULT NULL,
  `analytic_code` VARCHAR(100) DEFAULT NULL,
  `pay_type` VARCHAR(50) DEFAULT NULL,
  `date` DATE DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_analytic` (`analytic_id`),
  CONSTRAINT `fk_activities_analytics` FOREIGN KEY (`analytic_id`) REFERENCES `analytics`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
