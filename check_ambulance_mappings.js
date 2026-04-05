const { getPool } = require('./services/db')

async function check() {
  const pool = getPool()
  try {
    // Check for Ambulance code 723033
    const [mappings] = await pool.query(
      `SELECT * FROM activity_ebrigade_mappings WHERE ebrigade_analytic_name LIKE '%723033%'`
    )
    console.log('=== MAPPINGS FOR 723033 (Ambulance) ===')
    console.log('Count:', mappings.length)
    console.log(JSON.stringify(mappings, null, 2))

    // Also check activities for Ambulance analytique
    const [ambulanceActs] = await pool.query(
      `SELECT * FROM activities WHERE analytic_id = 3`
    )
    console.log('\n=== ACTIVITIES FOR AMBULANCE (analytic_id=3) ===')
    console.log('Count:', ambulanceActs.length)
    console.log(JSON.stringify(ambulanceActs, null, 2))

    // Check all new prestations with Ambulance code
    const [prest] = await pool.query(
      `SELECT id, invoice_number, ebrigade_activity_code, ebrigade_activity_name, analytic_id FROM prestations WHERE ebrigade_activity_code LIKE '%723033%' LIMIT 5`
    )
    console.log('\n=== PRESTATIONS WITH Ambulance CODE (723033) ===')
    console.log('Count:', prest.length)
    console.log(JSON.stringify(prest, null, 2))

  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    process.exit(0)
  }
}

check()
