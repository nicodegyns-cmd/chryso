#!/usr/bin/env node

const { getPool } = require('../services/db')

async function cleanupMappings() {
  const pool = getPool()
  try {
    console.log('Cleaning up activity_ebrigade_mappings to keep only 4-digit codes...')
    
    // Get all current mappings
    const [mappings] = await pool.query(`
      SELECT id, activity_id, ebrigade_analytic_name 
      FROM activity_ebrigade_mappings
    `)
    
    console.log(`Found ${mappings.length} mappings total`)
    
    let deletedCount = 0
    let keptCount = 0
    
    // For each mapping, check if it's just a code or a name
    for (const m of mappings) {
      const isCodeOnly = /^\d{4}$/.test(m.ebrigade_analytic_name)
      
      if (!isCodeOnly) {
        // Extract the code from the name (e.g., "9336" from "9336 — Permanence INFI")
        const codeMatch = m.ebrigade_analytic_name.match(/^(\d{4})/)
        if (codeMatch) {
          const code = codeMatch[1]
          console.log(`  - Deleting "${m.ebrigade_analytic_name}" (keeping as code ${code})`)
          await pool.query(
            'DELETE FROM activity_ebrigade_mappings WHERE id = $1',
            [m.id]
          )
          deletedCount++
        }
      } else {
        console.log(`  - Keeping code-only entry: ${m.ebrigade_analytic_name}`)
        keptCount++
      }
    }
    
    console.log(`\n✓ Done: Deleted ${deletedCount}, Kept ${keptCount}`)
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

cleanupMappings()
