-- Track PDF send history
CREATE TABLE IF NOT EXISTS pdf_sends (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analytic_id INT,
  analytic_code VARCHAR(255),
  analytic_name VARCHAR(255),
  recipient_emails TEXT COMMENT 'JSON array of email addresses',
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_by VARCHAR(255) COMMENT 'Admin email or username who triggered the send',
  prestation_count INT DEFAULT 0,
  first_prestation_date DATE,
  last_prestation_date DATE,
  filename VARCHAR(512),
  status ENUM('success', 'failed', 'partial') DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
