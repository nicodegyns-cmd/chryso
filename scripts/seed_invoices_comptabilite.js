// Seed sample invoices for UI testing
// Force local MySQL for seeding in development
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/chryso'
const db = require('../services/db')

async function run() {
  try {
    const pool = db.getPool()

    // pick up to 5 users (prefer non-comptabilite)
    let [users] = await pool.query('SELECT id, email, role FROM users WHERE role != ? LIMIT 5', ['comptabilite'])
    if (!users || users.length === 0) {
      const res = await pool.query('SELECT id, email, role FROM users LIMIT 5')
      users = res[0] || []
    }

    if (!users || users.length === 0) {
      console.error('No users found to assign invoices to')
      process.exit(1)
    }

    const statuses = ['pending','paid','overdue']
    const inserted = []

    // try to pick an analytic if available
    let analyticId = null
    try{
      const [aRows] = await pool.query('SELECT id FROM analytics LIMIT 1')
      if (Array.isArray(aRows) && aRows.length > 0) analyticId = aRows[0].id
    }catch(e){ /* ignore */ }

    for (let i = 0; i < 6; i++) {
      const u = users[i % users.length]
      const invoiceNumber = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(i+1).padStart(3,'0')}`
      const amount = (Math.random() * 450 + 50).toFixed(2)
      const status = statuses[i % statuses.length]
      const due = new Date(Date.now() + (i * 3 + 7) * 24 * 3600 * 1000)
      const dueStr = due.toISOString().slice(0,19).replace('T',' ')

      const [res] = await pool.execute(
        `INSERT INTO invoices (invoice_number, user_id, amount, description, status, due_date, analytic_id, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE analytic_id = IF(VALUES(analytic_id) IS NOT NULL, VALUES(analytic_id), analytic_id)`,
        [invoiceNumber, u.id, amount, `Facture test ${invoiceNumber}`, status, dueStr, analyticId, null]
      )

      const id = res && res.insertId ? res.insertId : null
      inserted.push({ id, invoiceNumber, user_id: u.id, amount, status })
      console.log('Inserted invoice', invoiceNumber, 'id=', id)
    }

    console.log('\nDone. Inserted', inserted.length, 'invoices.')
    process.exit(0)
  } catch (err) {
    console.error('Error seeding invoices:', err.message)
    process.exit(1)
  }
}

run()
