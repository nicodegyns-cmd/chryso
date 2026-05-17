const { Pool } = require('pg')
const pool = new Pool({
  host: 'ay177071-001.eu.clouddb.ovh.net',
  port: 35230,
  database: 'fenix',
  user: 'fenix',
  password: 'Toulouse94',
  ssl: { rejectUnauthorized: false }
})

async function main() {
  const r = await pool.query(`
    SELECT p.*, u.first_name, u.last_name, u.email, u.role
    FROM prestations p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.ebrigade_id = '9699' OR p.request_ref = '00018' OR p.invoice_number LIKE '%00018%'
    ORDER BY p.created_at DESC
    LIMIT 5
  `)
  if (r.rows.length === 0) {
    console.log('Prestation non trouvée')
  } else {
    const p = r.rows[0]
    console.log('=== Prestation #18 ===')
    console.log('ID:', p.id)
    console.log('Utilisateur:', p.first_name, p.last_name, '|', p.email)
    console.log('Rôle:', p.role)
    console.log('Status:', p.status)
    console.log('Type:', p.type)
    console.log('Date:', p.date)
    console.log('Ebrigade ID:', p.ebrigade_id)
    console.log('hours_actual:', p.hours_actual)
    console.log('garde_hours:', p.garde_hours)
    console.log('sortie_hours:', p.sortie_hours)
    console.log('overtime_hours:', p.overtime_hours)
    console.log('remuneration_infi:', p.remuneration_infi)
    console.log('remuneration_med:', p.remuneration_med)
    console.log('analytic_id:', p.analytic_id)
    console.log('analytic_name:', p.analytic_name)
    console.log('comments:', p.comments)
    console.log('created_at:', p.created_at)
    console.log('updated_at:', p.updated_at)
    console.log('validated_by_id:', p.validated_by_id)
  }
  await pool.end()
}
main().catch(e => { console.error(e.message); process.exit(1) })
