const { getPool } = require('../services/db')

async function main(){
  const id = process.argv[2]
  if (!id){
    console.error('Usage: node scripts/inspect_prestation.js <prestation_id>')
    process.exit(2)
  }
  const pool = getPool()
  try{
    const [rows] = await pool.query('SELECT p.id, p.analytic_id, an.code AS analytic_code, p.invoice_number, p.pdf_url, p.status, p.updated_at FROM prestations p LEFT JOIN analytics an ON p.analytic_id = an.id WHERE p.id = ? LIMIT 1', [id])
    console.log(JSON.stringify(rows && rows[0] || {}, null, 2))
    process.exit(0)
  }catch(e){
    console.error('Error', e && e.message)
    process.exit(1)
  }
}

main()
