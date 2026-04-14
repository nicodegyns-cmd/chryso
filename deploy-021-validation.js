/**
 * Deploy Migration 021: Add validation tracking to prestations
 * Run: node deploy-021-validation.js
 */
const { Pool } = require('pg')
const path = require('path')
const fs = require('fs')

// Load environment variables
require('dotenv').config()

async function deploy() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  try {
    console.log('🔌 Connecting to database...')
    const client = await pool.connect()
    console.log('✅ Connected to PostgreSQL')

    // Check if migration 021 is already applied
    console.log('\n📋 Checking migration status...')
    const checkResult = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'prestations' AND column_name = 'validated_at'`
    )

    if (checkResult.rows.length > 0) {
      console.log('✅ Migration 021 already applied (validated_at column exists)')
      client.release()
      await pool.end()
      return
    }

    // Read and apply migration SQL
    console.log('\n⚙️  Applying migration 021...')
    const sqlPath = path.join(__dirname, 'sql', '021_add_validation_columns_to_prestations.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    const statements = sql.split(';').filter(s => s.trim().length > 0)
    let applied = 0, skipped = 0

    for (const statement of statements) {
      try {
        await client.query(statement.trim())
        applied++
        console.log(`  ✓ ${statement.slice(0, 50).trim()}...`)
      } catch (err) {
        if (err.message.includes('already exists') || err.code === '42701' || err.code === '42P07') {
          skipped++
          console.log(`  ⊘ Already exists: ${statement.slice(0, 50).trim()}...`)
        } else {
          throw err
        }
      }
    }

    console.log(`\n✅ Migration completed!`)
    console.log(`   Applied: ${applied}, Skipped: ${skipped}, Total: ${statements.length}`)

    // Verify columns exist
    console.log('\n🔍 Verifying columns...')
    const verifyResult = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'prestations' 
       AND column_name IN ('validated_at', 'validated_by_id', 'validated_by_email')
       ORDER BY column_name`
    )

    console.log('   Columns in prestations table:')
    verifyResult.rows.forEach(row => {
      console.log(`   ✓ ${row.column_name} (${row.data_type})`)
    })

    // Verify indexes exist
    console.log('\n📇 Verifying indexes...')
    const indexResult = await client.query(
      `SELECT indexname FROM pg_indexes 
       WHERE tablename = 'prestations' 
       AND indexname LIKE 'idx_prestations_validated%'`
    )

    console.log(`   Found ${indexResult.rows.length} validation indexes:`)
    indexResult.rows.forEach(row => {
      console.log(`   ✓ ${row.indexname}`)
    })

    client.release()

    console.log('\n✨ Deployment successful!')
    console.log('   The following features are now available:')
    console.log('   • Tracking who validated prestations (validated_by_id, validated_by_email)')
    console.log('   • Timestamp of validation (validated_at)')
    console.log('   • Admin panel now shows "Validé par" column')

  } catch (err) {
    console.error('❌ Deployment failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

deploy()
