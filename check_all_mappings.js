const { getPool } = require('./services/db')

async function checkAllAnalytics() {
  const pool = getPool()
  try {
    console.log('='.repeat(80))
    console.log('VÉRIFICATION COMPLÈTE DE TOUS LES MAPPINGS EBRIGADE')
    console.log('='.repeat(80))

    // Get all analytics
    const [analytics] = await pool.query(
      `SELECT id, name, code, analytic_type FROM analytics ORDER BY code, name`
    )

    console.log(`\nAnalytics trouvées: ${analytics.length}\n`)

    for (const analytic of analytics) {
      console.log(`\n${'─'.repeat(80)}`)
      console.log(`ANALYTIQUE: [${analytic.code}] ${analytic.name} (ID: ${analytic.id})`)
      console.log(`  Type: ${analytic.analytic_type || 'N/A'}`)
      
      // 1. Check activities for this analytic
      const [activities] = await pool.query(
        `SELECT id, pay_type, remuneration_infi, remuneration_med FROM activities WHERE analytic_id = $1`,
        [analytic.id]
      )
      console.log(`  ├─ Activités: ${activities.length}`)
      if (activities.length > 0) {
        activities.forEach((act, idx) => {
          const isLast = idx === activities.length - 1
          console.log(`  ${isLast ? '└─' : '├─'} [${act.id}] ${act.pay_type} (INFI: €${act.remuneration_infi}, MED: €${act.remuneration_med})`)
        })
      }

      // 2. Check eBrigade mappings
      const [mappings] = await pool.query(
        `SELECT aem.id, aem.ebrigade_analytic_name, aem.activity_id, a.pay_type
         FROM activity_ebrigade_mappings aem
         LEFT JOIN activities a ON aem.activity_id = a.id
         WHERE a.analytic_id = $1
         ORDER BY aem.ebrigade_analytic_name`,
        [analytic.id]
      )
      console.log(`  ├─ Mappings eBrigade: ${mappings.length}`)
      if (mappings.length > 0) {
        mappings.forEach((map, idx) => {
          const isLast = idx === mappings.length - 1
          console.log(`  ${isLast ? '└─' : '├─'} Code "${map.ebrigade_analytic_name}" → Activity ${map.activity_id} (${map.pay_type})`)
        })
      } else {
        console.log(`  └─ ⚠️  AUCUN MAPPING - Les nouvelles prestations ne seront pas assignées!`)
      }

      // 3. Check prestations with pdf_url for this analytic
      const [prestations] = await pool.query(
        `SELECT COUNT(*) as count FROM prestations WHERE analytic_id = $1 AND pdf_url IS NOT NULL AND pdf_url != '' AND status = $2`,
        [analytic.id, "En attente d'envoie"]
      )
      const count = prestations[0]?.count || 0
      console.log(`  └─ Prestations prêtes à envoyer: ${count}`)
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`)
    console.log('RÉSUMÉ')
    console.log('='.repeat(80))

    const [summary] = await pool.query(
      `SELECT 
        COUNT(DISTINCT a.id) as total_analytics,
        COUNT(DISTINCT CASE WHEN aem.id IS NOT NULL THEN a.id END) as with_mappings,
        COUNT(DISTINCT CASE WHEN aem.id IS NULL THEN a.id END) as without_mappings
       FROM analytics a
       LEFT JOIN activities act ON a.id = act.analytic_id
       LEFT JOIN activity_ebrigade_mappings aem ON act.id = aem.activity_id`
    )

    const info = summary[0]
    console.log(`\nAnalytics totales: ${info.total_analytics}`)
    console.log(`Avec mappings: ${info.with_mappings} ✓`)
    console.log(`Sans mappings: ${info.without_mappings} ⚠️`)

    // Check for orphan prestations
    const [orphans] = await pool.query(
      `SELECT COUNT(*) as count FROM prestations WHERE analytic_id IS NULL AND pdf_url IS NOT NULL AND pdf_url != '' AND status = $1`,
      ["En attente d'envoie"]
    )
    console.log(`\nPrestations orphelines (sans analytique): ${orphans[0]?.count || 0}`)

  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    process.exit(0)
  }
}

checkAllAnalytics()
