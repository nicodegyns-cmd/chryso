// Migration: add file_data BYTEA column to documents table if missing
const { getPool } = require('./services/db')

async function migrate() {
  const pool = getPool()
  try {
    const check = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='documents' AND column_name='file_data'"
    )
    if (check.rows.length > 0) {
      console.log('✅ file_data column already exists')
    } else {
      await pool.query('ALTER TABLE documents ADD COLUMN file_data BYTEA')
      console.log('✅ file_data column added (BYTEA)')
    }

    // Also show all columns for verification
    const cols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='documents' ORDER BY ordinal_position"
    )
    console.log('Columns:', cols.rows.map(r => r.column_name + ':' + r.data_type).join(', '))
    process.exit(0)
  } catch (e) {
    console.error('❌ Migration failed:', e.message)
    process.exit(1)
  }
}

migrate()
