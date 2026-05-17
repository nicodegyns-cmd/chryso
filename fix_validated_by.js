require('dotenv').config({ path: '.env.local' })
const { getPool } = require('./services/db')

async function main() {
  const pool = getPool()
  
  // Find Gilles Thesin
  const userRes = await pool.query(`
    SELECT id, email, first_name, last_name FROM users 
    WHERE LOWER(first_name) LIKE '%gilles%' OR LOWER(last_name) LIKE '%thesin%' OR LOWER(last_name) LIKE '%thésin%'
  `)
  console.log('Found users:', userRes.rows)
  
  if (userRes.rows.length === 0) {
    console.log('User not found! Searching all users...')
    const all = await pool.query(`SELECT id, email, first_name, last_name FROM users ORDER BY id`)
    all.rows.forEach(u => console.log(`  id=${u.id} ${u.first_name} ${u.last_name} <${u.email}>`))
    process.exit(1)
  }
  
  const gilles = userRes.rows[0]
  console.log(`\nUsing: id=${gilles.id} ${gilles.first_name} ${gilles.last_name} <${gilles.email}>`)
  
  // Count prestations to update
  const count = await pool.query(`
    SELECT COUNT(*) FROM prestations 
    WHERE status = 'Envoyé à la facturation' AND validated_by_id IS NULL
  `)
  console.log(`\nPrestations to update: ${count.rows[0].count}`)
  
  // Update
  const upd = await pool.query(`
    UPDATE prestations 
    SET validated_by_id = $1, validated_by_email = $2, validated_at = CURRENT_TIMESTAMP
    WHERE status = 'Envoyé à la facturation' AND validated_by_id IS NULL
  `, [gilles.id, gilles.email])
  
  console.log(`\n✅ Updated ${upd.rowCount} prestations with validated_by = ${gilles.first_name} ${gilles.last_name}`)
  process.exit(0)
}
main().catch(e => { console.error(e.message); process.exit(1) })
