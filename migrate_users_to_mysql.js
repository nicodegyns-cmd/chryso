const fs = require('fs')
const path = require('path')
const { getPool } = require('./services/db')

async function main() {
  const pool = getPool()
  // Ensure users table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  const dataFile = path.join(process.cwd(), 'data', 'users.json')
  if (!fs.existsSync(dataFile)) {
    console.log('No data/users.json found — nothing to migrate.')
    return
  }
  const raw = fs.readFileSync(dataFile, 'utf8')
  let users = []
  try { users = JSON.parse(raw) } catch (e) { console.error('Invalid users.json'); return }

  for (const u of users) {
    const email = (u.email || '').toLowerCase()
    if (!email) continue
    // upsert: insert ignore then update role if different
    try {
      await pool.query('INSERT IGNORE INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)', [email, u.passwordHash || '', u.role || 'user', u.created_at || new Date()])
      // update role if exists and differs
      await pool.query('UPDATE users SET role = ? WHERE email = ? AND role != ?', [u.role || 'user', email, u.role || 'user'])
      console.log('Migrated', email)
    } catch (err) {
      console.error('Failed migrating', email, err.message)
    }
  }

  console.log('Migration finished')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
