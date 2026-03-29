const { getPool } = require('./db')
const bcrypt = require('bcryptjs')

async function ensureUsersTable() {
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

async function createUser({ email, password, role = 'user' }) {
  const pool = getPool()
  const normalized = (email || '').toLowerCase()
  const q0 = await pool.query('SELECT id FROM users WHERE email = $1', [normalized])
  const rows0 = q0.rows || []
  if (rows0.length > 0) throw new Error('User already exists')
  const hash = await bcrypt.hash(password, 10)
  let canonicalRole = (role || 'user').toString()
  const low = canonicalRole.toLowerCase()
  if (low.includes('infi') || low.includes('infirm')) canonicalRole = 'INFI'
  else if (low.includes('med')) canonicalRole = 'MED'
  else if (low === 'admin') canonicalRole = 'admin'
  else canonicalRole = 'user'

  const resQ = await pool.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', [normalized, hash, canonicalRole])
  const insertedId = resQ.rows?.[0]?.id || null
  return { id: insertedId, email: normalized, role: canonicalRole }
}

async function verifyUser(email, password) {
  const pool = getPool()
  const normalized = (email || '').toLowerCase()
  const q = await pool.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [normalized])
  const rows = q.rows || []
  if (!rows || rows.length === 0) return null
  const user = rows[0]
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return null
  return { id: user.id, email: user.email, role: user.role }
}

async function findUserByEmail(email) {
  const pool = getPool()
  const normalized = (email || '').toLowerCase()
  const q = await pool.query('SELECT id, email, role FROM users WHERE email = $1', [normalized])
  const rows = q.rows || []
  if (!rows || rows.length === 0) return null
  return rows[0]
}

module.exports = { ensureUsersTable, createUser, verifyUser, findUserByEmail }
