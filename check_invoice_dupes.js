const { getPool } = require('./services/db')

async function checkDupes() {
  const pool = getPool()
  const res = await pool.query(`
    SELECT invoice_number, user_id, COUNT(*) AS nb,
      array_agg(id ORDER BY id) AS ids,
      array_agg(pdf_url ORDER BY id) AS pdfs
    FROM prestations
    WHERE status = 'Facturé' AND invoice_number IS NOT NULL
    GROUP BY invoice_number, user_id
    HAVING COUNT(*) > 1
    ORDER BY invoice_number
  `)
  console.log('Duplicate invoice numbers:', res.rows.length)
  res.rows.forEach(r => {
    console.log(`  invoice=${r.invoice_number} user=${r.user_id} nb=${r.nb} ids=${r.ids}`)
  })
  process.exit(0)
}
checkDupes().catch(e => { console.error(e.message); process.exit(1) })
