#!/usr/bin/env node

const { getPool } = require('../services/db')

async function addMissingMappings() {
  const pool = getPool()
  try {
    console.log('🔧 Adding missing eBrigade name mappings...\n')

    // List all local activities first
    console.log('📋 Local activities:')
    const activitiesResult = await pool.query(`
      SELECT id, analytic_name, pay_type FROM activities ORDER BY id
    `)
    activitiesResult.rows.forEach(a => {
      console.log(`   Activity ${a.id}: "${a.analytic_name}" (${a.pay_type})`)
    })

    console.log('\n')

    // Helper to find activity by name pattern
    const findActivityByNamePattern = async (pattern) => {
      const result = await pool.query(
        'SELECT id FROM activities WHERE LOWER(analytic_name) LIKE LOWER($1) LIMIT 1',
        [`%${pattern}%`]
      )
      return result.rows?.[0]?.id || null
    }

    // Patterns to add based on eBrigade feedback
    const patternsToAdd = [
      // From error logs - APS variants
      { pattern: 'APS', description: 'APS activity (all variants)' },
      { pattern: 'Équipe Médicale', description: 'Medical team' },
      { pattern: 'Permanence INFI', description: 'Nursing duty' },
      { pattern: 'Garde', description: 'Guard/On-call' },
      { pattern: 'Garde NUIT', description: 'Night guard' },
      // Add more as needed
      { pattern: 'SMUR', description: 'Mobile emergency medical unit' },
      { pattern: 'RMP', description: 'RMP activity' },
      { pattern: 'Ambulance', description: 'Ambulance' }
    ]

    console.log('🔗 Adding/checking mappings:\n')

    for (const item of patternsToAdd) {
      // Try to find activity by pattern
      let activityId = await findActivityByNamePattern(item.pattern)
      
      if (!activityId) {
        console.log(`❌ No activity found for pattern "${item.pattern}" - skipping`)
        continue
      }

      // Check if mapping already exists
      const existingResult = await pool.query(
        `SELECT id FROM activity_ebrigade_name_mappings 
         WHERE activity_id = $1 AND ebrigade_analytic_name_pattern = $2`,
        [activityId, item.pattern]
      )

      if (existingResult.rows.length > 0) {
        console.log(`✓ Already mapped: "${item.pattern}" → Activity ${activityId}`)
      } else {
        // Add new mapping
        try {
          await pool.query(
            `INSERT INTO activity_ebrigade_name_mappings (activity_id, ebrigade_analytic_name_pattern)
             VALUES ($1, $2)
             RETURNING id`,
            [activityId, item.pattern]
          )
          console.log(`✅ Added: "${item.pattern}" → Activity ${activityId} (${item.description})`)
        } catch (e) {
          console.log(`⚠️  Failed to add "${item.pattern}": ${e.message}`)
        }
      }
    }

    console.log('\n📊 Final state - All mappings by activity:')
    const finalResult = await pool.query(`
      SELECT 
        a.id,
        a.analytic_name,
        string_agg(nam.ebrigade_analytic_name_pattern, ', ' ORDER BY nam.ebrigade_analytic_name_pattern) as ebrigade_patterns
      FROM activities a
      LEFT JOIN activity_ebrigade_name_mappings nam ON a.id = nam.activity_id
      GROUP BY a.id, a.analytic_name
      ORDER BY a.id
    `)

    finalResult.rows.forEach(row => {
      const patterns = row.ebrigade_patterns ? row.ebrigade_patterns.split(', ').filter(p => p) : []
      const marker = patterns.length > 0 ? '✓' : '⚠️'
      console.log(`  ${marker} Activity ${row.id}: "${row.analytic_name}"`)
      if (patterns.length > 0) {
        patterns.forEach(p => console.log(`      → "${p}"`))
      } else {
        console.log(`      → (no mappings)`)
      }
    })

    console.log('\n✅ Done!')
    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

addMissingMappings()
