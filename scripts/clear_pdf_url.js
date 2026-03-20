const { getPool } = require('../services/db')

async function main(){
  const id = process.argv[2]
  if (!id){
    console.error('Usage: node scripts/clear_pdf_url.js <prestation_id>')
    process.exit(2)
  }
  const pool = getPool()
  try{
    const [res] = await pool.query('UPDATE prestations SET pdf_url = NULL WHERE id = ?', [id])
    console.log('Cleared pdf_url for prestation', id, 'result:', res && res.affectedRows)
    process.exit(0)
  }catch(e){
    console.error('Error clearing pdf_url', e && e.message)
    process.exit(1)
  }
}

main()
