const { query } = require('./services/db')

async function main() {
  const r = await query(
    `SELECT id, email, first_name, last_name, onboarding_status, is_active,
            invitation_token IS NOT NULL AS has_token,
            telephone
     FROM users
     WHERE is_active = 0 AND onboarding_status IN ('pending_signup', 'pending_validation')
     ORDER BY onboarding_status, created_at DESC`
  )
  const rows = r.rows || r[0] || []
  console.log(`\n=== Total: ${rows.length} utilisateurs en attente ===`)
  const pv = rows.filter(u => u.onboarding_status === 'pending_validation')
  const ps = rows.filter(u => u.onboarding_status === 'pending_signup')
  console.log(`pending_validation: ${pv.length}`)
  console.log(`pending_signup:     ${ps.length}`)
  console.log(`\n--- pending_validation (${pv.length}) ---`)
  pv.forEach(u => {
    const neverConnected = u.has_token && (!u.telephone || u.telephone === '')
    console.log(`  id=${u.id} | ${u.first_name} ${u.last_name} | ${u.email} | tel=${u.telephone||'null'} | never_connected=${neverConnected}`)
  })
  process.exit(0)
}
main().catch(e => { console.error(e.message); process.exit(1) })
