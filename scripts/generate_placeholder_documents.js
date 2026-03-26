'use strict'
// Generate placeholder PDF documents (RIB and fiche) for users
const fs = require('fs')
const path = require('path')
// Force local MySQL for seeding in development when DATABASE_URL not set
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/chryso'
const { getPool } = require('../services/db')

function makePdfBuffer(text) {
  const pdf = `"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${20 + text.length} >>\nstream\nBT /F1 18 Tf 50 120 Td (${text}) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000110 00000 n \n0000000200 00000 n \ntrailer\n<< /Root 1 0 R >>\nstartxref\n300\n%%EOF`;
  return Buffer.from(pdf, 'binary')
}

async function run() {
  const pool = getPool()
  try {
    // fetch up to 10 users (excluding comptabilite role)
    const [users] = await pool.query('SELECT id, email, role FROM users WHERE role != ? LIMIT 10', ['comptabilite'])
    if (!users || users.length === 0) {
      const [all] = await pool.query('SELECT id, email, role FROM users LIMIT 10')
      users = all || []
    }

    // Count existing documents
    const [before] = await pool.query('SELECT COUNT(*) as cnt FROM documents')
    console.log('Documents before:', before[0].cnt)

    let created = 0
    for (const u of users) {
      // RIB
      const ribName = `RIB_${u.id}.pdf`
      const ribBuf = makePdfBuffer(`RIB for ${u.email}`)
      try {
        const [res] = await pool.execute(
          `INSERT INTO documents (user_id, name, type, file_path, file_data, file_size, validation_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [u.id, ribName, 'PDF', ribName, ribBuf, ribBuf.length, 'pending']
        )
        created++
        console.log('Inserted RIB for', u.email, 'id=', res.insertId)
      } catch (e) {
        console.error('Failed to insert RIB for', u.email, e.message)
      }

      // Fiche
      const ficheName = `FICHE_${u.id}.pdf`
      const ficheBuf = makePdfBuffer(`Fiche for ${u.email}`)
      try {
        const [res2] = await pool.execute(
          `INSERT INTO documents (user_id, name, type, file_path, file_data, file_size, validation_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [u.id, ficheName, 'PDF', ficheName, ficheBuf, ficheBuf.length, 'pending']
        )
        created++
        console.log('Inserted FICHE for', u.email, 'id=', res2.insertId)
      } catch (e) {
        console.error('Failed to insert FICHE for', u.email, e.message)
      }
    }

    const [after] = await pool.query('SELECT COUNT(*) as cnt FROM documents')
    console.log('Documents after:', after[0].cnt)
    console.log('Created documents:', created)
    process.exit(0)
  } catch (err) {
    console.error('Error:', err && err.message)
    process.exit(1)
  }
}

run()
