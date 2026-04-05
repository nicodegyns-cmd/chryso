const { getPool } = require('./services/db')

async function assignOrphanPrestations() {
  const pool = getPool()
  try {
    console.log('='.repeat(80))
    console.log('ASSIGNMENT AUTO DES PRESTATIONS ORPHELINES')
    console.log('='.repeat(80))

    // Get all orphan prestations
    const [orphans] = await pool.query(
      `SELECT id, ebrigade_activity_code, ebrigade_activity_name FROM prestations 
       WHERE analytic_id IS NULL AND pdf_url IS NOT NULL AND pdf_url != '' AND status = $1
       ORDER BY ebrigade_activity_code`,
      ["En attente d'envoie"]
    )

    console.log(`\nTrouvé ${orphans.length} prestations orphelines\n`)

    let assigned = 0
    let unassigned = 0

    for (const prestation of orphans) {
      const code = prestation.ebrigade_activity_code
      const name = prestation.ebrigade_activity_name

      // Try to find a matching activity via mapping
      const [activities] = await pool.query(
        `SELECT a.id, a.analytic_id FROM activities a
         WHERE a.id IN (
           SELECT DISTINCT aem.activity_id FROM activity_ebrigade_mappings aem
           WHERE aem.ebrigade_analytic_name = $1
         )
         LIMIT 1`,
        [code]
      )

      if (activities.length > 0) {
        const analyticId = activities[0].analytic_id
        await pool.query(
          `UPDATE prestations SET analytic_id = $1 WHERE id = $2`,
          [analyticId, prestation.id]
        )
        console.log(`✓ [${prestation.id}] Code ${code} → Analytique ${analyticId}`)
        assigned++
      } else {
        console.log(`✗ [${prestation.id}] Code ${code} - AUCUN MAPPING TROUVÉ`)
        unassigned++
      }
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`Assignées: ${assigned}`)
    console.log(`Non assignées: ${unassigned}`)
    console.log('='.repeat(80))

  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    process.exit(0)
  }
}

assignOrphanPrestations()
