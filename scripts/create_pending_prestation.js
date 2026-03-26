const db = require('../services/db')

async function run() {
  try {
    const date = new Date().toISOString().slice(0,10)
    const insertSql = `INSERT INTO prestations (user_id, analytic_id, date, pay_type, hours_actual, remuneration_infi, remuneration_med, comments, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const params = [1, null, date, 'Garde', 8, 45.00, 120.00, 'Demande test admin - générée automatiquement', 'En attente']

    const res = await db.query(insertSql, params)
    // For MySQL the insert returns an object with insertId; for portability we'll fetch the last inserted row for the user/date
    const rows = await db.query('SELECT * FROM prestations WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1', [1, date])
    if (!rows || rows.length === 0) {
      console.log('Aucune prestation insérée ou introuvable.')
      process.exit(1)
    }
    console.log('Prestation insérée:')
    console.log(rows[0])
    process.exit(0)
  } catch (err) {
    console.error('Erreur lors de l\'insertion:', err)
    process.exit(1)
  }
}

if (require.main === module) run()

module.exports = { run }
