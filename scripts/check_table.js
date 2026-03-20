const { getPool } = require('../services/db')
;(async function(){
  try{
    const pool = getPool()
    const [rows] = await pool.query("SHOW TABLES LIKE 'users'")
    console.log(rows)
    process.exit(0)
  }catch(err){
    console.error('ERROR', err.message)
    process.exit(1)
  }
})()
