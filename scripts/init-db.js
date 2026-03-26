// scripts/init-db.js
// Initialize database tables if they don't exist

const mysql = require('mysql2/promise');

async function initDatabase() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'chryso'
    });

    console.log('[INIT-DB] Creating documents table if not exists...');

    const sql = `
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await conn.execute(sql);
    console.log('[INIT-DB] ✅ Documents table ready');

    await conn.end();
  } catch (err) {
    console.error('[INIT-DB] Error:', err.message);
    // Don't exit - let the app continue even if DB init fails
  }
}

module.exports = { initDatabase };
