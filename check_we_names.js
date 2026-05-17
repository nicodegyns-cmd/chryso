const { getPool } = require('./services/db')

async function main() {
  const pool = getPool()
  const r = await pool.query(`
    SELECT DISTINCT p.ebrigade_activity_name, a.name AS analytic_name, p.pay_type
    FROM prestations p
    LEFT JOIN analytics a ON p.analytic_id = a.id
    WHERE p.ebrigade_activity_name IS NOT NULL OR p.pay_type IS NOT NULL
    ORDER BY p.ebrigade_activity_name
    LIMIT 100
  `)
  console.log('=== Noms activités eBrigade ===')
  r.rows.forEach(row => {
    console.log(`ebrigade_activity_name: "${row.ebrigade_activity_name}" | analytic_name: "${row.analytic_name}" | pay_type: "${row.pay_type}"`)
  })
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
