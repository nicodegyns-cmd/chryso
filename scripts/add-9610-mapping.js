#!/usr/bin/env node

const { getPool } = require('../services/db')

async function addMapping() {
  const pool = getPool()
  try {
    console.log('Adding 9610 mapping to activity_id=4...')
    const result = await pool.query(
      'INSERT INTO activity_ebrigade_mappings (activity_id, ebrigade_analytic_name) VALUES ($1, $2)',
      [4, '9610']
    )
    console.log('Insert result:', result)
    
    // Verify
    const [mappings] = await pool.query(
      'SELECT * FROM activity_ebrigade_mappings WHERE activity_id = 4 ORDER BY ebrigade_analytic_name'
    )
    console.log('Activity 4 mappings:', mappings.map(m => m.ebrigade_analytic_name))
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

addMapping()
