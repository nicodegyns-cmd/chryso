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
      is_active BOOLEAN DEFAULT false,
      onboarding_status VARCHAR(50) DEFAULT 'incomplete',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  // Add new columns if they don't exist (safe for existing DBs)
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false")
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'incomplete'")
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_complete_profile BOOLEAN DEFAULT true")
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_cgu BOOLEAN DEFAULT false")
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_privacy BOOLEAN DEFAULT false")
  } catch (err) {
    console.warn('[userStore] ensureUsersTable: could not alter users table', err.message)
  }
}

async function createUser({ email, password, role = 'user' }) {
  const pool = getPool()
  const normalized = (email || '').toLowerCase()
  const q0 = await pool.query('SELECT id FROM users WHERE email = $1', [normalized])
  const rows0 = q0.rows || (Array.isArray(q0) ? q0[0] : [])
  if (Array.isArray(rows0) && rows0.length > 0) throw new Error('User already exists')
  const hash = await bcrypt.hash(password, 10)
  // Normalize role to canonical values stored in DB
  let canonicalRole = (role || 'user').toString()
  const low = canonicalRole.toLowerCase()
  if (low.includes('infi') || low.includes('infirm')) canonicalRole = 'INFI'
  else if (low.includes('med')) canonicalRole = 'MED'
  else if (low === 'admin') canonicalRole = 'admin'
  else canonicalRole = 'user'

  const resQ = await pool.query('INSERT INTO users (email, password_hash, role, is_active, must_complete_profile, accepted_cgu, accepted_privacy, onboarding_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [normalized, hash, canonicalRole, false, true, false, false, 'incomplete'])
  const insertedId = resQ.rows?.[0]?.id || null
  return { id: insertedId, email: normalized, role: canonicalRole }
}

async function verifyUser(email, password) {
  const pool = getPool()
  const normalized = (email || '').toLowerCase()
  console.log('[DB DEBUG] verifyUser SQL', 'SELECT id, email, password_hash, role, must_complete_profile, accepted_cgu, accepted_privacy, is_active, onboarding_status, can_view_statistics FROM users WHERE email = $1', [normalized])
  const q = await pool.query('SELECT id, email, password_hash, role, must_complete_profile, accepted_cgu, accepted_privacy, is_active, onboarding_status, can_view_statistics FROM users WHERE email = $1', [normalized])
  console.log('[DB DEBUG] query result type:', typeof q, 'isArray:', Array.isArray(q), 'has rows prop:', !!q.rows)
  const rows = Array.isArray(q) && q.length > 0 ? q[0] : (q && q.rows ? q.rows : [])
  console.log('[DB DEBUG] rows type:', typeof rows, 'isArray:', Array.isArray(rows), 'length:', rows ? rows.length : 'N/A')
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('[DB DEBUG] No rows found')
    return null
  }
  const user = rows[0]
  console.log('[DB DEBUG] Found user, checking password')
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) {
    console.log('[DB DEBUG] Password mismatch')
    return null
  }
  console.log('[DB DEBUG] Password OK, returning user')
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    must_complete_profile: user.must_complete_profile,
    accepted_cgu: user.accepted_cgu,
    accepted_privacy: user.accepted_privacy,
    is_active: user.is_active,
    onboarding_status: user.onboarding_status,
    can_view_statistics: user.can_view_statistics
  }
}

async function findUserByEmail(email) {
  const pool = getPool()
  const normalized = (email || '').toLowerCase()
  const q = await pool.query('SELECT id, email, role FROM users WHERE email = $1', [normalized])
  const rows = q.rows || (Array.isArray(q) ? q[0] : [])
  if (!Array.isArray(rows) || rows.length === 0) return null
  return rows[0]
}

module.exports = { ensureUsersTable, createUser, verifyUser, findUserByEmail }
