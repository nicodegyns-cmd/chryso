#!/usr/bin/env node

const { getPool } = require('../services/db')

async function checkActivityMappings() {
  const pool = getPool()
  try {
    console.log('Checking activity_ebrigade_mappings by activity...\n')
    
    const [rows] = await pool.query(`
      SELECT 
        a.id,
        a.analytic_name,
        a.analytic_code,
        a.pay_type,
        a.remuneration_infi,
        a.remuneration_med,
        string_agg(aam.ebrigade_analytic_name, ', ' ORDER BY aam.ebrigade_analytic_name) as mapped_codes
      FROM activities a
      LEFT JOIN activity_ebrigade_mappings aam ON a.id = aam.activity_id
      GROUP BY a.id, a.analytic_name, a.analytic_code, a.pay_type, a.remuneration_infi, a.remuneration_med
      ORDER BY a.id
    `)
    
    console.log(`Found ${rows.length} activities:\n`)
    
    rows.forEach(a => {
      const codes = a.mapped_codes ? a.mapped_codes.split(', ') : []
      const hasMapping = codes.length > 0
      const marker = hasMapping ? '✓' : '✗'
      console.log(`${marker} ID=${a.id}: "${a.analytic_name}" (Code: ${a.analytic_code}, Type: ${a.pay_type})`)
      if (hasMapping) {
        console.log(`     Mapped codes: ${codes.join(', ')}`)
        console.log(`     Rates: INFI=${a.remuneration_infi}€, MED=${a.remuneration_med}€`)
      } else {
        console.log(`     ⚠️  NO MAPPED CODES`)
      }
      console.log()
    })
    
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

checkActivityMappings()
