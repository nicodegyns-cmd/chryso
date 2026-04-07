/**
 * Migration: Ensure ebrigade_activity_name column exists and is populated
 * 
 * This script:
 * 1. Creates ebrigade_activity_name column if it doesn't exist
 * 2. Populates it from activity pay_type + analytic_code for eBrigade prestations
 * 3. Enables proper PDF grouping by activity prefix
 */

const { getPool } = require('../services/db')

async function migrate() {
  const pool = getPool()
  
  try {
    console.log('[ensure-ebrigade-column] Starting migration...')
    
    // Step 1: Create column if it doesn't exist
    console.log('[ensure-ebrigade-column] Creating ebrigade_activity_name column if needed...')
    await pool.query(`
      ALTER TABLE prestations 
      ADD COLUMN IF NOT EXISTS ebrigade_activity_name VARCHAR(255)
    `)
    console.log('[ensure-ebrigade-column]   ✅ Column exists or created')
    
    // Step 2: Populate ebrigade_activity_name for eBrigade prestations
    // Query: if ebrigade_activity_name is NULL but we have ebrigade_activity_code,
    // try to find matching activity and use its description
    console.log('[ensure-ebrigade-column] Populating ebrigade_activity_name...')
    
    const result = await pool.query(`
      UPDATE prestations p
      SET ebrigade_activity_name = COALESCE(
        ebrigade_activity_name,
        -- Fallback: create from activity type + code if available
        CASE 
          WHEN ebrigade_activity_code IS NOT NULL AND pay_type IS NOT NULL 
          THEN CONCAT(pay_type, ' - ', ebrigade_activity_code)
          WHEN ebrigade_activity_code IS NOT NULL 
          THEN ebrigade_activity_code
          WHEN pay_type IS NOT NULL 
          THEN pay_type
          ELSE NULL
        END
      )
      WHERE ebrigade_activity_code IS NOT NULL 
        AND ebrigade_activity_name IS NULL
    `)
    console.log(`[ensure-ebrigade-column]   ✅ Updated ${result.rowCount} rows`)
    
    // Step 3: Verify the population
    const countResult = await pool.query(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN ebrigade_activity_name IS NOT NULL THEN 1 ELSE 0 END) as with_name
      FROM prestations
      WHERE ebrigade_activity_code IS NOT NULL
    `)
    const counts = countResult.rows[0]
    console.log(`[ensure-ebrigade-column] Total eBrigade prestations: ${counts.total}`)
    console.log(`[ensure-ebrigade-column] With ebrigade_activity_name: ${counts.with_name}`)
    
    // Step 4: Show some examples
    const examples = await pool.query(`
      SELECT id, ebrigade_activity_code, ebrigade_activity_name, pay_type
      FROM prestations
      WHERE ebrigade_activity_code IS NOT NULL
      LIMIT 5
    `)
    console.log('[ensure-ebrigade-column] Examples:')
    examples.rows.forEach(row => {
      console.log(`  - ${row.id}: ${row.ebrigade_activity_name}`)
    })
    
    console.log('[ensure-ebrigade-column] ✅ Migration complete!')
    process.exit(0)
    
  } catch (err) {
    console.error('[ensure-ebrigade-column] ❌ Error:', err.message)
    process.exit(1)
  }
}

migrate()
