const { getPool } = require('../services/db')
;(async ()=>{
  const pool = getPool()
  try{
    const [rows] = await pool.query("SHOW TABLES LIKE 'prestations'")
    console.log('SHOW TABLES result:', rows)
    const [dbs] = await pool.query('SELECT DATABASE() as db')
    console.log('Current DB:', dbs && dbs[0] && dbs[0].db)
    process.exit(0)
  }catch(err){
    console.error('check failed', err.message)
    process.exit(1)
  }
})()
