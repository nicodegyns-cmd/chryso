#!/usr/bin/env node

const { getPool } = require('../services/db')

async function checkMappings() {
  const pool = getPool()
  try {
    console.log('Checking activity_ebrigade_mappings...\n')
    
    const [rows] = await pool.query(`
      SELECT activity_id, ebrigade_analytic_name, created_at
      FROM activity_ebrigade_mappings
      ORDER BY activity_id, ebrigade_analytic_name
    `)
    
    console.log(`Found ${rows.length} mappings:\n`)
    
    rows.forEach(row => {
      const isCode = /^\d{4}$/.test(row.ebrigade_analytic_name)
      const marker = isCode ? '✓ CODE' : '✗ NAME'
      console.log(`  ${marker}: activity_id=${row.activity_id}, ebrigade_analytic_name="${row.ebrigade_analytic_name}"`)
    })
    
    console.log('\n--- Summary ---')
    const codeOnly = rows.filter(r => /^\d{4}$/.test(r.ebrigade_analytic_name))
    const withName = rows.filter(r => !/^\d{4}$/.test(r.ebrigade_analytic_name))
    console.log(`Code-only entries: ${codeOnly.length}`)
    console.log(`Name-based entries: ${withName.length}`)
    console.log(`Total: ${rows.length}`)
    
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

checkMappings()
