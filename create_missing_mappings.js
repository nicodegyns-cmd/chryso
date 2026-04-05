const { getPool } = require('./services/db')

async function createMissingMappings() {
  const pool = getPool()
  try {
    console.log('Création des mappings manquants...\n')

    // Vivalia - code 159585 (DMP)
    console.log('1. Vivalia (ID 5) - Code: 159585')
    await pool.query(
      `INSERT INTO activity_ebrigade_mappings (ebrigade_analytic_name, activity_id)
       VALUES ('159585', 8)
       ON CONFLICT DO NOTHING`
    )
    console.log('   ✓ Mapping créé: 159585 → Activity 8 (Permanence)\n')

    // RMP - code 722040-RMP (SSCR-MED)
    console.log('2. RMP (ID 6) - Code: 722040-RMP')
    await pool.query(
      `INSERT INTO activity_ebrigade_mappings (ebrigade_analytic_name, activity_id)
       VALUES ('722040-RMP', 7)
       ON CONFLICT DO NOTHING`
    )
    console.log('   ✓ Mapping créé: 722040-RMP → Activity 7 (RMP)\n')

    // Also try variations
    await pool.query(
      `INSERT INTO activity_ebrigade_mappings (ebrigade_analytic_name, activity_id)
       VALUES ('722040', 7)
       ON CONFLICT DO NOTHING`
    )
    console.log('   ✓ Mapping créé (variation): 722040 → Activity 7 (RMP)\n')

    // Projet Marie Curie - code 177723-HUB25-MC - BUT NO ACTIVITY!
    console.log('3. Projet Marie Curie (ID 7) - Code: 177723-HUB25-MC')
    console.log('   ⚠️  ATTENTION: Aucune activité configurée pour cette analytique!')
    console.log('   ➜ À créer manuellement dans la page Analytics\n')

    console.log('='.repeat(60))
    console.log('Vérification finale des mappings...\n')

    const [vivalia] = await pool.query(
      `SELECT COUNT(*) as count FROM activity_ebrigade_mappings aem 
       JOIN activities a ON aem.activity_id = a.id 
       WHERE a.analytic_id = 5`
    )
    console.log(`Vivalia: ${vivalia[0].count} mapping(s)`)

    const [rmp] = await pool.query(
      `SELECT COUNT(*) as count FROM activity_ebrigade_mappings aem 
       JOIN activities a ON aem.activity_id = a.id 
       WHERE a.analytic_id = 6`
    )
    console.log(`RMP: ${rmp[0].count} mapping(s)`)

    const [marie] = await pool.query(
      `SELECT COUNT(*) as count FROM activities WHERE analytic_id = 7`
    )
    console.log(`Projet Marie Curie: ${marie[0].count} activité(s) - NÉCESSITE CONFIGURATION MANUELLE`)

  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    process.exit(0)
  }
}

createMissingMappings()
