// pages/api/comptabilite/finalize-export.js
// Finalise l'export : fusionne les PDFs individuels en compilation,
// marque toutes les prestations "Facturé", envoie les emails.
// Appelé par le frontend après que tous les export-single-invoice ont réussi.

const { getPool } = require('../../../services/db')
const { sendStatusChangeEmail } = require('../../../services/emailService')
const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

export const config = {
  api: { responseLimit: false },
  maxDuration: 60,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { pdf_filenames, all_prestation_ids, analytic_name } = req.body || {}

    if (!Array.isArray(pdf_filenames) || pdf_filenames.length === 0) {
      return res.status(400).json({ error: 'pdf_filenames requis' })
    }
    if (!Array.isArray(all_prestation_ids) || all_prestation_ids.length === 0) {
      return res.status(400).json({ error: 'all_prestation_ids requis' })
    }

    const pool = getPool()
    const exportsDir = path.join(process.cwd(), 'public', 'exports')
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true })

    // 1. Fusionner tous les PDFs individuels
    const mergedPdf = await PDFDocument.create()
    for (const filename of pdf_filenames) {
      // Sécurité : n'accepter que des noms de fichiers PDF valides
      if (!filename.match(/^[\w.-]+\.pdf$/)) {
        console.warn('[finalize-export] nom de fichier invalide ignoré :', filename)
        continue
      }
      const filePath = path.join(exportsDir, filename)
      if (!fs.existsSync(filePath)) {
        console.warn('[finalize-export] fichier introuvable :', filePath)
        continue
      }
      const pdfBuffer = fs.readFileSync(filePath)
      const userDoc = await PDFDocument.load(pdfBuffer)
      const pages = await mergedPdf.copyPages(userDoc, userDoc.getPageIndices())
      pages.forEach(p => mergedPdf.addPage(p))
    }

    if (mergedPdf.getPageCount() === 0) {
      return res.status(422).json({ error: 'Aucun PDF valide trouvé pour la compilation' })
    }

    const mergedPdfBytes = await mergedPdf.save()

    // 2. Sauvegarder la compilation sur disque
    const dateStr = new Date().toISOString().split('T')[0]
    const analyticSlug = (analytic_name || '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
    const compilationFilename = analyticSlug
      ? `Compilation_Factures_${analyticSlug}_${dateStr}-${Date.now()}.pdf`
      : `Compilation_Factures_${dateStr}-${Date.now()}.pdf`
    fs.writeFileSync(path.join(exportsDir, compilationFilename), Buffer.from(mergedPdfBytes))

    // 3. Marquer toutes les prestations comme "Facturé"
    await pool.query(
      `UPDATE prestations SET status = 'Facturé', updated_at = NOW() WHERE id = ANY($1)`,
      [all_prestation_ids]
    )

    // 4. Envoyer les emails (fire-and-forget, par utilisateur)
    try {
      const usersRes = await pool.query(
        `SELECT DISTINCT ON (p.user_id)
           p.user_id, u.email, u.first_name,
           p.date, p.invoice_number, p.analytic_id,
           an.name AS analytic_name
         FROM prestations p
         LEFT JOIN users u  ON p.user_id = u.id
         LEFT JOIN analytics an ON p.analytic_id = an.id
         WHERE p.id = ANY($1) AND u.email IS NOT NULL
         ORDER BY p.user_id, p.date DESC`,
        [all_prestation_ids]
      )
      for (const row of usersRes.rows) {
        sendStatusChangeEmail({
          userEmail: row.email,
          firstName: row.first_name || '',
          status: 'Facturé',
          date: row.date,
          analyticName: row.analytic_name || analytic_name || null,
          invoiceNumber: row.invoice_number || null,
        }).catch(e => console.error('[finalize-export] email error for', row.email, e.message))
      }
    } catch (e) {
      console.error('[finalize-export] erreur envoi emails :', e.message)
    }

    const downloadUrl = `/api/exports/download?file=${encodeURIComponent(compilationFilename)}`
    return res.status(200).json({
      compilation_filename: compilationFilename,
      download_url: downloadUrl,
    })
  } catch (err) {
    console.error('[finalize-export]', err.message)
    return res.status(500).json({ error: err.message || 'Erreur interne' })
  }
}
