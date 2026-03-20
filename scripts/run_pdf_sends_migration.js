const { getPool } = require('../services/db')
const fs = require('fs')
const path = require('path')

async function runMigration(){
  const pool = getPool()
  try{
    const sqlPath = path.join(__dirname, '..', 'sql', '009_create_pdf_sends_table.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    
    console.log('Executing migration: 009_create_pdf_sends_table.sql')
    await pool.query(sql)
    
    console.log('✅ Migration completed successfully')
    process.exit(0)
  }catch(err){
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  }
}

runMigration()
