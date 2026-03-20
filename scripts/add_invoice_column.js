const { getPool } = require('../services/db')

async function main(){
  const pool = getPool()
  try{
    await pool.query("ALTER TABLE prestations ADD COLUMN invoice_number VARCHAR(64) DEFAULT NULL")
    console.log('invoice_number column added')
    process.exit(0)
  }catch(e){
    console.error('Error adding column (maybe already exists):', e && e.message)
    process.exit(1)
  }
}

main()
