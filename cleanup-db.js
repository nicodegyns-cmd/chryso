#!/usr/bin/env node
/**
 * Script de nettoyage de la base de données
 * Supprime :
 * - Toutes les prestations
 * - Toutes les activités
 * - Tous les fichiers PDF générés
 * Garde :
 * - Tous les comptes utilisateurs
 * - Les analytiques
 */

const { getPool } = require('./services/db')
const fs = require('fs')
const path = require('path')

async function cleanup() {
  const pool = getPool()

  try {
    console.log('🧹 Début du nettoyage de la base de données...\n')

    // 1. Supprimer les prestations
    console.log('1️⃣ Suppression des prestations...')
    const prestResult = await pool.query('DELETE FROM prestations')
    console.log(`   ✓ ${prestResult.rowCount || 0} prestations supprimées`)

    // 2. Supprimer les activités
    console.log('2️⃣ Suppression des activités...')
    const actResult = await pool.query('DELETE FROM activities')
    console.log(`   ✓ ${actResult.rowCount || 0} activités supprimées`)

    // 3. Supprimer les PDFs générés
    console.log('3️⃣ Suppression des fichiers PDF...')
    const exportsDir = path.join(process.cwd(), 'public', 'exports')
    if (fs.existsSync(exportsDir)) {
      const files = fs.readdirSync(exportsDir)
      let deletedCount = 0
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          const filePath = path.join(exportsDir, file)
          fs.unlinkSync(filePath)
          deletedCount++
        }
      }
      console.log(`   ✓ ${deletedCount} fichiers PDF supprimés`)
    } else {
      console.log('   ℹ Dossier exports n\'existe pas')
    }

    // 4. Récupérer les stats finales
    console.log('\n📊 État final de la base de données:')
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users')
    const prestCount = await pool.query('SELECT COUNT(*) as count FROM prestations')
    const actCount = await pool.query('SELECT COUNT(*) as count FROM activities')
    const analytCount = await pool.query('SELECT COUNT(*) as count FROM analytics')

    console.log(`   👤 Utilisateurs: ${userCount.rows[0]?.count || 0}`)
    console.log(`   📋 Prestations: ${prestCount.rows[0]?.count || 0}`)
    console.log(`   ⚙️  Activités: ${actCount.rows[0]?.count || 0}`)
    console.log(`   📊 Analytiques: ${analytCount.rows[0]?.count || 0}`)

    console.log('\n✅ Nettoyage terminé avec succès!\n')
    process.exit(0)
  } catch (err) {
    console.error('❌ Erreur lors du nettoyage:', err.message)
    process.exit(1)
  }
}

cleanup()
