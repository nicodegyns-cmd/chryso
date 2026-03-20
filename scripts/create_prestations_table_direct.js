const fs = require('fs')
const path = require('path')
const { getPool } = require('../services/db')

async function run(){
  const pool = getPool()
  const sqlPath = path.join(__dirname, '..', 'sql', '004_create_prestations_table.sql')
  let sql = fs.readFileSync(sqlPath, 'utf8')
  // extract CREATE TABLE block
  const match = sql.match(/CREATE\s+TABLE[\s\S]*?\)\s*ENGINE=/i)
  if(!match){
    console.error('Could not find CREATE TABLE block')
    process.exit(1)
  }
  // append closing ;
  const createStmt = match[0].replace(/ENGINE=.*$/s, m => m) + ';'
  try{
    console.log('Running CREATE TABLE statement...')
    await pool.query(createStmt)
    console.log('Table created (or already exists).')
    process.exit(0)
  }catch(err){
    console.error('Create table failed:', err.message)
    process.exit(1)
  }
}
run()
