/**
 * Migration: add reminder_1_sent_at and reminder_2_sent_at columns to prestations table.
 * Run once on the server: node add_reminder_columns.js
 */
const { getPool } = require('./services/db')

async function run() {
  const pool = getPool()
  try {
    await pool.query(`ALTER TABLE prestations ADD COLUMN IF NOT EXISTS reminder_1_sent_at TIMESTAMP DEFAULT NULL`)
    console.log('✅ Column reminder_1_sent_at added (or already exists)')

    await pool.query(`ALTER TABLE prestations ADD COLUMN IF NOT EXISTS reminder_2_sent_at TIMESTAMP DEFAULT NULL`)
    console.log('✅ Column reminder_2_sent_at added (or already exists)')

    // Verify
    const check = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'prestations'
        AND column_name IN ('reminder_1_sent_at', 'reminder_2_sent_at')
    `)
    const cols = (check.rows || check[0] || []).map(r => r.column_name)
    console.log('✅ Columns confirmed in DB:', cols)
    process.exit(0)
  } catch(e) {
    console.error('❌ Migration failed:', e.message)
    process.exit(1)
  }
}

run()
