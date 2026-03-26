const mysql = require('mysql2/promise')
const fs = require('fs')

async function run(){
  let conn
  try{
    conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'chryso', multipleStatements: true })
    console.log('[Migration] Connected to DB')
    const sql = fs.readFileSync('./sql/017_add_analytic_to_invoices.sql', 'utf8')
    await conn.query(sql)
    console.log('[Migration] Applied 017_add_analytic_to_invoices.sql')
    process.exit(0)
  }catch(e){ console.error('[Migration] Error', e && e.message); process.exit(1) }
  finally{ if (conn) await conn.end() }
}

run()
