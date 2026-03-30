const db = require('../services/db')

async function createTable() {
  try {
    console.log('Creating ebrigade_analytics_mapping table...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS ebrigade_analytics_mapping (
        id SERIAL PRIMARY KEY,
        ebrigade_analytic_name VARCHAR(255) UNIQUE NOT NULL,
        local_analytic_id INTEGER NOT NULL REFERENCES analytics(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Table ebrigade_analytics_mapping created successfully')

    // Create index for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ebrigade_analytic_name 
      ON ebrigade_analytics_mapping(ebrigade_analytic_name)
    `)
    console.log('✓ Index created')
  } catch (error) {
    console.error('Error creating table:', error.message)
    process.exit(1)
  }
}

createTable()
