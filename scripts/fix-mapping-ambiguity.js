#!/usr/bin/env node

const { getPool } = require('../services/db')

async function fixMappingAmbiguity() {
  const pool = getPool()
  try {
    console.log('🔧 Fixing eBrigade mapping ambiguities...\n')

    // Remove incorrect mappings
    console.log('🗑️ Removing duplicate/incorrect mappings:\n')

    // Fix: Remove "APS" from Activity 7 (RMP) - it should only map to "RMP"
    const removeFromRMP = await pool.query(
      `DELETE FROM activity_ebrigade_name_mappings 
       WHERE activity_id = 7 AND ebrigade_analytic_name_pattern = 'APS'
       RETURNING id`
    )
    if (removeFromRMP.rows.length > 0) {
      console.log('✅ Removed: "APS" from Activity 7 (RMP) - Activity 7 should only map to "RMP"')
    }

    // Ensure Activity 7 (RMP) maps to "RMP"
    const addRMPMapping = await pool.query(
      `INSERT INTO activity_ebrigade_name_mappings (activity_id, ebrigade_analytic_name_pattern)
       VALUES (7, 'RMP')
       ON CONFLICT(activity_id, ebrigade_analytic_name_pattern) DO NOTHING
       RETURNING id`
    )
    if (addRMPMapping.rows.length > 0) {
      console.log('✅ Ensured: "RMP" → Activity 7')
    } else {
      console.log('✓ Already mapped: "RMP" → Activity 7')
    }

    // Ensure Activity 6 (APS) maps to all APS variants
    const apsPatterns = ['APS', 'Equipe Médicale', 'Équipe Médicale']
    for (const pattern of apsPatterns) {
      const result = await pool.query(
        `INSERT INTO activity_ebrigade_name_mappings (activity_id, ebrigade_analytic_name_pattern)
         VALUES (6, $1)
         ON CONFLICT(activity_id, ebrigade_analytic_name_pattern) DO NOTHING
         RETURNING id`,
        [pattern]
      )
      if (result.rows.length > 0) {
        console.log(`✅ Ensured: "${pattern}" → Activity 6 (APS)`)
      } else {
        console.log(`✓ Already mapped: "${pattern}" → Activity 6`)
      }
    }

    console.log('\n📊 Final corrected mappings:')
    const finalResult = await pool.query(`
      SELECT 
        a.id,
        a.analytic_name,
        string_agg(nam.ebrigade_analytic_name_pattern, ', ' ORDER BY nam.ebrigade_analytic_name_pattern) as patterns
      FROM activities a
      LEFT JOIN activity_ebrigade_name_mappings nam ON a.id = nam.activity_id
      GROUP BY a.id, a.analytic_name
      ORDER BY a.id
    `)

    finalResult.rows.forEach(row => {
      const patterns = row.patterns ? row.patterns.split(', ').filter(p => p) : []
      if (patterns.length > 0) {
        console.log(`  ✓ Activity ${row.id}: "${row.analytic_name}"`)
        patterns.forEach(p => console.log(`      → "${p}"`))
      }
    })

    console.log('\n✅ Fixed! Now each pattern maps to exactly ONE activity:')
    console.log('  • "APS" → Activity 6 (APS)')
    console.log('  • "RMP" → Activity 7 (RMP)')
    console.log('  • "Equipe Médicale" → Activity 6 (APS)')
    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

fixMappingAmbiguity()
