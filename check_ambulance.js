const { getPool } = require('./services/db')

async function check() {
  const pool = getPool()
  try {
    // Check Ambulance analytic
    const [[analytic]] = await pool.query('SELECT * FROM analytics WHERE id = 3')
    console.log('\n=== AMBULANCE ANALYTIC ===')
    console.log(analytic)

    // Check prestations for this analytic
    const [prestations] = await pool.query(
      `SELECT id, invoice_number, pdf_url, status, analytic_id 
       FROM prestations 
       WHERE analytic_id = 3 
       LIMIT 10`
    )
    console.log('\n=== PRESTATIONS WITH analytic_id = 3 ===')
    console.log(`Count: ${prestations.length}`)
    console.log(prestations)

    // Check prestations with status En attente d'envoie and pdf_url
    const [ready] = await pool.query(
      `SELECT id, invoice_number, pdf_url, status, analytic_id 
       FROM prestations 
       WHERE analytic_id = 3 
         AND pdf_url IS NOT NULL 
         AND pdf_url != '' 
         AND status = 'En attente d\'envoie'
       LIMIT 10`
    )
    console.log('\n=== READY TO SEND (analytic_id=3, pdf_url, status="En attente d\'envoie") ===')
    console.log(`Count: ${ready.length}`)
    console.log(ready)

    // Check if there are prestations without analytic_id
    const [orphans] = await pool.query(
      `SELECT id, invoice_number, pdf_url, status, analytic_id, ebrigade_activity_code, ebrigade_activity_name
       FROM prestations 
       WHERE analytic_id IS NULL 
         AND pdf_url IS NOT NULL 
         AND status = 'En attente d\'envoie'
       LIMIT 5`
    )
    console.log('\n=== ORPHAN PRESTATIONS (no analytic_id) ===')
    console.log(`Count: ${orphans.length}`)
    console.log(orphans)

  } catch (err) {
    console.error('Error:', err)
  } finally {
    process.exit(0)
  }
}

check()
