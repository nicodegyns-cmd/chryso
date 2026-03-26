import { getPool } from './services/db.js'

async function debug() {
  try {
    const pool = getPool()
    
    // Check table structure
    console.log('\n=== TABLE STRUCTURE ===')
    const [columns] = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'documents'
      ORDER BY ordinal_position
    `)
    
    if (columns.length === 0) {
      console.log('❌ TABLE DOES NOT EXIST')
      return
    }
    
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`)
    })
    
    // Check document count
    console.log('\n=== DOCUMENT COUNT ===')
    const [count] = await pool.query('SELECT COUNT(*) as total FROM documents')
    console.log(`Total documents: ${count[0].total}`)
    
    // Check pending documents
    console.log('\n=== PENDING DOCUMENTS ===')
    const [pending] = await pool.query(`
      SELECT d.id, d.user_id, d.name, d.validation_status, d.created_at, u.email
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.validation_status = 'pending'
      ORDER BY d.created_at DESC
    `)
    
    if (pending.length === 0) {
      console.log('❌ NO PENDING DOCUMENTS')
    } else {
      pending.forEach(doc => {
        console.log(`  ID: ${doc.id}, User: ${doc.email}, Name: ${doc.name}, Status: ${doc.validation_status}`)
      })
    }
    
    // Check all documents
    console.log('\n=== ALL DOCUMENTS ===')
    const [all] = await pool.query(`
      SELECT d.id, d.user_id, d.name, d.validation_status, d.created_at, u.email
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `)
    
    if (all.length === 0) {
      console.log('❌ NO DOCUMENTS AT ALL')
    } else {
      all.forEach(doc => {
        console.log(`  [${doc.validation_status}] ${doc.id} - ${doc.email} - ${doc.name}`)
      })
    }
    
  } catch (e) {
    console.error('ERROR:', e.message)
  }
  
  process.exit(0)
}

debug()
