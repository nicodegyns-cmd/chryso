const fs = require('fs')
const path = require('path')
const { getPool } = require('../services/db')

async function run(){
  const pool = getPool()
  try{
    const [ok] = await pool.query('SELECT 1 as ok')
    console.log('DB test:', ok)
  }catch(e){
    console.error('DB test failed:', e)
    process.exit(1)
  }

  const sqlPath = path.join(__dirname, '..', 'sql', '004_create_prestations_table.sql')
  let sql = fs.readFileSync(sqlPath, 'utf8')
  const match = sql.match(/CREATE\s+TABLE[\s\S]*?\)\s*ENGINE=/i)
  if(!match){
    console.error('Could not find CREATE TABLE block')
    process.exit(1)
  }
  const createStmt = match[0] + ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
  try{
    console.log('Running create statement...')
    await pool.query(createStmt)
    console.log('Create succeeded')
  }catch(err){
    console.error('Create failed full error:', err)
    console.error('Create failed message:', err.message)
    console.error('Create failed code:', err.code)
    console.error('Create failed sqlMessage:', err.sqlMessage)
    console.error('Create failed sql:', err.sql)
    process.exit(1)
  }
}
run()
