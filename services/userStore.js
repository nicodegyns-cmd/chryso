const { getPool } = require('./db')
const bcrypt = require('bcryptjs')

async function ensureUsersTable() {
  const pool = getPool()
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
}

async function createUser({ email, password, role = 'user' }) {
  const pool = getPool()
  const normalized = (email || '').toLowerCase()
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [normalized])
  if (rows && rows.length > 0) throw new Error('User already exists')
  const hash = await bcrypt.hash(password, 10)
  // Normalize role to canonical values stored in DB
  let canonicalRole = (role || 'user').toString()
  const low = canonicalRole.toLowerCase()
  if (low.includes('infi') || low.includes('infirm')) canonicalRole = 'INFI'
  else if (low.includes('med')) canonicalRole = 'MED'
  else if (low === 'admin') canonicalRole = 'admin'
  else canonicalRole = 'user'

  const [res] = await pool.query('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [normalized, hash, canonicalRole])
  return { id: res.insertId, email: normalized, role: canonicalRole }
}

async function verifyUser(email, password) {
  const pool = getPool()
  const normalized = (email || '').toLowerCase()
  const [rows] = await pool.query('SELECT id, email, password_hash, role FROM users WHERE email = ?', [normalized])
  if (!rows || rows.length === 0) return null
  const user = rows[0]
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return null
  return { id: user.id, email: user.email, role: user.role }
}

async function findUserByEmail(email) {
  const pool = getPool()
  const normalized = (email || '').toLowerCase()
  const [rows] = await pool.query('SELECT id, email, role FROM users WHERE email = ?', [normalized])
  if (!rows || rows.length === 0) return null
  return rows[0]
}

module.exports = { ensureUsersTable, createUser, verifyUser, findUserByEmail }
