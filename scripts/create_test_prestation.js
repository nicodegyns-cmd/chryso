const { getPool } = require('../services/db')

async function main(){
  const pool = getPool()
  try{
    const email = 'gilles.thesin@hotmail.com'
    const analyticName = 'Ambulance'
    // find user
    const [[user]] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
    if (!user) { console.error('User not found:', email); process.exit(2) }
    // find analytic
    const [[an]] = await pool.query('SELECT * FROM analytics WHERE LOWER(name) = ? LIMIT 1', [analyticName.toLowerCase()])
    if (!an) { console.error('Analytic not found:', analyticName); process.exit(3) }

    // prepare date today
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    const isoDate = `${yyyy}-${mm}-${dd}`

    const insert = {
      user_id: user.id,
      analytic_id: an.id,
      pay_type: 'permanence',
      hours_actual: 8,
      garde_hours: 0,
      sortie_hours: 0,
      overtime_hours: 0,
      remuneration_infi: 0,
      remuneration_med: 0,
      expense_amount: 0,
      date: isoDate,
      status: 'Approuvé'
    }

    const keys = Object.keys(insert)
    const vals = keys.map(k => insert[k])
    const placeholders = keys.map(_=> '?').join(', ')
    const sql = `INSERT INTO prestations (${keys.join(',')}) VALUES (${placeholders})`
    const [res] = await pool.query(sql, vals)
    console.log('Inserted prestation id', res.insertId)
    process.exit(0)
  }catch(e){
    console.error('failed', e && e.message)
    process.exit(1)
  }
}

main()
