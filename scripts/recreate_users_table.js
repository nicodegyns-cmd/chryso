const { getPool } = require('../services/db')

;(async function(){
  const pool = getPool()
  try {
    console.log('Dropping users table if exists...')
    await pool.query('DROP TABLE IF EXISTS users')
    console.log('Creating users table...')
    await pool.query(`
      CREATE TABLE users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('Table recreated successfully')
    process.exit(0)
  } catch (err) {
    console.error('Error recreating table:', err.message)
    process.exit(1)
  }
})()
