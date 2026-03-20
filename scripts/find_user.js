const { getPool } = require('../services/db')

async function main(){
  const term = process.argv[2]
  if (!term){
    console.error('Usage: node scripts/find_user.js <search>')
    process.exit(2)
  }
  const pool = getPool()
  try{
    const q = `%${term}%`
    const [rows] = await pool.query('SELECT id, email, first_name, last_name, fonction FROM users WHERE email LIKE ? OR first_name LIKE ? OR last_name LIKE ? LIMIT 20', [q,q,q])
    console.log(JSON.stringify(rows, null, 2))
  }catch(err){
    console.error('query error', err.message || err)
    process.exit(1)
  }finally{
    // allow exit
    process.exit(0)
  }
}

main()
