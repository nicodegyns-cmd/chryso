const { getPool } = require('./services/db')

async function main() {
  const pool = getPool()
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_statistics BOOLEAN DEFAULT FALSE`)
    console.log('OK: colonne can_view_statistics ajoutée (ou déjà existante)')
  } catch (err) {
    console.error('Erreur:', err.message)
    process.exit(1)
  }
  process.exit(0)
}

main()
