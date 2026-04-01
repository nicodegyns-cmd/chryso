#!/usr/bin/env node

const { getPool } = require('../services/db')

async function syncCodes() {
  const pool = getPool()
  try {
    console.log('Syncing eBrigade codes from prestations...')
    
    // Get all unique analytic_codes from prestations that don't have analytic_id
    const [prestations] = await pool.query(`
      SELECT DISTINCT analytic_code, analytic_name 
      FROM prestations 
      WHERE analytic_code IS NOT NULL 
      AND analytic_code != ''
      ORDER BY analytic_code
    `)
    
    console.log(`Found ${prestations.length} unique eBrigade codes in prestations`)
    
    // For each code, log it so user can manually associate
    for (const prest of prestations) {
      console.log(`  - Code: ${prest.analytic_code}, Name: ${prest.analytic_name}`)
    }
    
    console.log('\n✓ Result: User must now manually associate each code to an activity via Admin UI')
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

syncCodes()
