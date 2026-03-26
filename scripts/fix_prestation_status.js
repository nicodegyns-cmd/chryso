const db = require('../services/db')

async function run(){
  try{
    const id = 23
    await db.query("UPDATE prestations SET status = ? WHERE id = ?", ["En attente d'approbation", id])
    const rows = await db.query('SELECT id,user_id,date,status,comments FROM prestations WHERE id = ?', [id])
    console.log(rows)
    await db.getPool().end()
    process.exit(0)
  }catch(e){
    console.error(e)
    process.exit(1)
  }
}

if(require.main===module) run()
module.exports = { run }
