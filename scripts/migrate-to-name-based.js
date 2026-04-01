#!/usr/bin/env node

const { getPool } = require('../services/db')

async function migrateToNameBasedMapping() {
  const pool = getPool()
  try {
    console.log('Migrating to name-based eBrigade mappings...\n')
    
    // Create new NAME-based table
    console.log('1️⃣ Creating activity_ebrigade_name_mappings table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_ebrigade_name_mappings (
        id SERIAL PRIMARY KEY,
        activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        ebrigade_analytic_name_pattern VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(activity_id, ebrigade_analytic_name_pattern)
      )
    `)
    console.log('   ✓ Table created')
    
    // Add mappings based on activity name patterns
    console.log('\n2️⃣ Adding default name mappings for known activities...')
    const defaultMappings = [
      { activity_id: 4, pattern: 'Permanence INFI' },
      { activity_id: 5, pattern: 'Garde' },
      { activity_id: 6, pattern: 'Ambulance' },
      { activity_id: 7, pattern: 'APS' }
    ]
    
    for (const mapping of defaultMappings) {
      try {
        const [result] = await pool.query(
          `INSERT INTO activity_ebrigade_name_mappings (activity_id, ebrigade_analytic_name_pattern)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING
           RETURNING id, activity_id, ebrigade_analytic_name_pattern`,
          [mapping.activity_id, mapping.pattern]
        )
        if (result.length > 0) {
          console.log(`   ✓ Added: activity_id=${mapping.activity_id}, pattern="${mapping.pattern}"`)
        }
      } catch (e) {
        console.log(`   ⚠️  Failed to add ${mapping.pattern}: ${e.message}`)
      }
    }
    
    // Show final state
    console.log('\n3️⃣ Final eBrigade name mappings:')
    const [final] = await pool.query(`
      SELECT 
        a.id,
        a.analytic_name,
        string_agg(nam.ebrigade_analytic_name_pattern, ', ' ORDER BY nam.ebrigade_analytic_name_pattern) as patterns
      FROM activities a
      LEFT JOIN activity_ebrigade_name_mappings nam ON a.id = nam.activity_id
      GROUP BY a.id, a.analytic_name
      ORDER BY a.id
    `)
    
    final.forEach(a => {
      const hasMapping = a.patterns ? a.patterns.split(', ').filter(p => p).length > 0 : 0
      const marker = hasMapping ? '✓' : '✗'
      console.log(`  ${marker} Activity ${a.id}: "${a.analytic_name}" → ${a.patterns || 'NONE'}`)
    })
    
    console.log(`\n✅ Done! Migration complete.`)
    console.log('\n📝 Now when Admin edits an activity:')
    console.log('   1. Input field: "Permanence INFI"')
    console.log('   2. All eBrigade codes with that name will auto-match')
    console.log('   3. Estimate lookup: E_LIBELLE → extract prefix → find activity')
    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

migrateToNameBasedMapping()
