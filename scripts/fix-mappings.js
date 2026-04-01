#!/usr/bin/env node

const { getPool } = require('../services/db')

async function fixMappings() {
  const pool = getPool()
  try {
    console.log('Fixing activity_ebrigade_mappings...\n')
    
    // First: Delete all name-based entries (keep only 4-digit codes)
    console.log('1️⃣ Removing name-based entries...')
    const [delResult] = await pool.query(`
      DELETE FROM activity_ebrigade_mappings 
      WHERE ebrigade_analytic_name !~ '^\d{4}$'
      RETURNING id, activity_id, ebrigade_analytic_name
    `)
    console.log(`   Deleted ${delResult.length} entries`)
    delResult.forEach(r => {
      console.log(`     - activity_id=${r.activity_id}: "${r.ebrigade_analytic_name}"`)
    })
    
    // Second: Add missing codes that map to activity_id=4 (Permanence INFI)
    console.log('\n2️⃣ Adding missing codes for activity_id=4 (Permanence INFI)...')
    const missingCodes = [
      { code: '9395', activity_id: 4 },
      { code: '9610', activity_id: 4 },
      { code: '9610b', activity_id: 4 }
    ]
    
    for (const mapping of missingCodes) {
      try {
        // INSERT ... ON CONFLICT DO NOTHING to avoid duplicates
        const [result] = await pool.query(`
          INSERT INTO activity_ebrigade_mappings (activity_id, ebrigade_analytic_name)
          VALUES ($1, $2)
          ON CONFLICT (activity_id, ebrigade_analytic_name) DO NOTHING
          RETURNING id, activity_id, ebrigade_analytic_name
        `, [mapping.activity_id, mapping.code])
        
        if (result.length > 0) {
          console.log(`   ✓ Added: activity_id=${mapping.activity_id}, code="${mapping.code}"`)
        } else {
          console.log(`   ⚠️  Already exists: activity_id=${mapping.activity_id}, code="${mapping.code}"`)
        }
      } catch (e) {
        console.log(`   ✗ Failed to add ${mapping.code}:`, e.message)
      }
    }
    
    // Third: Show final state
    console.log('\n3️⃣ Final mappings:')
    const [final] = await pool.query(`
      SELECT activity_id, ebrigade_analytic_name
      FROM activity_ebrigade_mappings
      ORDER BY activity_id, ebrigade_analytic_name
    `)
    
    final.forEach(r => {
      const isCode = /^\d+/.test(r.ebrigade_analytic_name)
      const marker = isCode ? '✓' : '✗'
      const type = isCode ? 'CODE' : 'NAME'
      console.log(`  ${marker} [${type}] activity_id=${r.activity_id}: "${r.ebrigade_analytic_name}"`)
    })
    
    console.log(`\n✅ Done! Total mappings: ${final.length}`)
    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

fixMappings()
