// Migration: Add travel_allowance column to prestations table
const { Pool } = require('pg')

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  
  try {
    console.log('🔧 Adding travel_allowance column to prestations table...')
    
    // Check if column already exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'prestations' AND column_name = 'travel_allowance'
    `
    const checkResult = await pool.query(checkQuery)
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Column travel_allowance already exists')
    } else {
      // Add the column
      const alterQuery = `
        ALTER TABLE prestations 
        ADD COLUMN travel_allowance DECIMAL(10, 2) DEFAULT 0
      `
      await pool.query(alterQuery)
      console.log('✅ Column travel_allowance added successfully')
    }
    
    // Verify the column was added
    const verifyQuery = `
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'prestations' AND column_name = 'travel_allowance'
    `
    const verifyResult = await pool.query(verifyQuery)
    console.log('📊 Column details:', verifyResult.rows[0])
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
