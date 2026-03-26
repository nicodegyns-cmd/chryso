// Add file_data column to documents table locally
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'chryso'
})

async function addColumn() {
  const connection = await pool.getConnection()
  try {
    // Check if column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'documents' AND COLUMN_NAME = 'file_data'
    `)

    if (columns.length > 0) {
      console.log('✅ file_data column already exists')
      return
    }

    // Add the column
    await connection.query(`
      ALTER TABLE documents ADD COLUMN file_data LONGBLOB
    `)
    console.log('✅ file_data column added successfully')

  } catch (e) {
    console.error('❌ Error:', e.message)
  } finally {
    connection.release()
    pool.end()
  }
}

addColumn()
