#!/usr/bin/env node
/**
 * Script de prévisualisation avant nettoyage
 */

const { getPool } = require('./services/db')
const fs = require('fs')
const path = require('path')

async function preview() {
  const pool = getPool()

  try {
    console.log('📊 APERÇU DES DONNÉES À SUPPRIMER:\n')

    // Compter les données
    const userResult = await pool.query('SELECT COUNT(*) as count FROM users WHERE role LIKE \'%INFI%\' OR role LIKE \'%MED%\'')
    const prestResult = await pool.query('SELECT COUNT(*) as count FROM prestations')
    const actResult = await pool.query('SELECT COUNT(*) as count FROM activities')
    const allUsersResult = await pool.query('SELECT COUNT(*) as count FROM users')

    console.log(`👤 Comptes utilisateurs TOTAL: ${allUsersResult.rows[0]?.count || 0} (CONSERVÉS)`)
    console.log(`   - INFI/MED: ${userResult.rows[0]?.count || 0}`)
    console.log('')
    console.log(`🗑️  DONNÉES À SUPPRIMER:`)
    console.log(`   📋 Prestations: ${prestResult.rows[0]?.count || 0}`)
    console.log(`   ⚙️  Activités: ${actResult.rows[0]?.count || 0}`)

    // Lister les PDFs
    const exportsDir = path.join(process.cwd(), 'public', 'exports')
    let pdfCount = 0
    if (fs.existsSync(exportsDir)) {
      const files = fs.readdirSync(exportsDir)
      pdfCount = files.filter(f => f.endsWith('.pdf')).length
    }
    console.log(`   📄 Fichiers PDF: ${pdfCount}`)

    console.log('\n✅ Pour continuer le nettoyage, exécutez: node cleanup-db.js')
    process.exit(0)
  } catch (err) {
    console.error('Erreur:', err.message)
    process.exit(1)
  }
}

preview()
