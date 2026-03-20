#!/usr/bin/env node
const { getPool } = require('../services/db')
const bcrypt = require('bcryptjs')

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error('Usage: node scripts/set_user_password.js user@example.com "NewP@ssw0rd"')
  process.exit(1)
}

(async () => {
  try {
    const pool = getPool()
    const hash = await bcrypt.hash(password, 10)
    const [res] = await pool.query('UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_sent_at = NULL WHERE LOWER(email) = ?', [hash, email.toLowerCase()])
    if (res.affectedRows === 0) {
      console.error('No user updated — check the email address exists')
      process.exit(2)
    }
    console.log('Password updated for', email)
    process.exit(0)
  } catch (err) {
    console.error('Error setting password:', err.message || err)
    process.exit(3)
  }
})()
