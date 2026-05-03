// pages/api/comptabilite/recompile-pdf.js
// Recompile les PDFs existants des prestations "Facturé" en un seul document
// Sans changer les statuts, sans envoyer d'emails

const { getPool } = require('../../../services/db')
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
    const pool = getPool()
    const { analytic_id, date_from, date_to, prestation_ids } = req.body || {}

    // Construire la requête selon les filtres
    const queryParams = []
    const conditions = [`p.status = 'Facturé'`, `p.pdf_url IS NOT NULL`, `p.pdf_url != ''`]

    if (Array.isArray(prestation_ids) && prestation_ids.length > 0) {
      queryParams.push(prestation_ids)
      conditions.push(`p.id = ANY($${queryParams.length})`)
    } else {
      if (analytic_id != null) {
        queryParams.push(analytic_id)
        conditions.push(`p.analytic_id = $${queryParams.length}`)
      }
      if (date_from) {
        queryParams.push(date_from)
        conditions.push(`p.date >= $${queryParams.length}`)
      }
      if (date_to) {
        queryParams.push(date_to)
        conditions.push(`p.date <= $${queryParams.length}`)
      }
    }

    const result = await pool.query(`
      SELECT
        p.id, p.invoice_number, p.pdf_url, p.date,
        u.first_name AS user_first_name, u.last_name AS user_last_name, u.company AS company_name,
        an.name AS analytic_name, an.code AS analytic_code
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics an ON p.analytic_id = an.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.invoice_number ASC, p.date ASC
    `, queryParams)

    const rows = result.rows || []
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Aucune facture PDF trouvée avec les filtres sélectionnés' })
    }

    // Fusionner les PDFs existants
    const mergedPdf = await PDFDocument.create()
    const basePath = path.join(process.cwd(), 'public')
    let loadedCount = 0
    const missing = []

    for (const row of rows) {
      if (!row.pdf_url) continue

      // Résoudre le chemin du fichier
      let filePath = null
      try {
        // Format: /api/exports/download?file=filename.pdf
        if (row.pdf_url.includes('?file=')) {
          const urlParams = new URL(row.pdf_url, 'http://localhost')
          const filename = urlParams.searchParams.get('file')
          if (filename) filePath = path.join(basePath, 'exports', filename)
        } else {
          // Format: /exports/filename.pdf
          filePath = path.join(basePath, row.pdf_url.replace(/^\/+/, ''))
        }
      } catch (e) {
        console.warn(`[recompile-pdf] Could not parse pdf_url for prestation ${row.id}:`, row.pdf_url)
        missing.push(row.id)
        continue
      }

      if (!filePath || !fs.existsSync(filePath)) {
        console.warn(`[recompile-pdf] File not found for prestation ${row.id}: ${filePath}`)
        missing.push(row.id)
        continue
      }

      try {
        const pdfBytes = fs.readFileSync(filePath)
        const doc = await PDFDocument.load(pdfBytes)
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices())
        pages.forEach(p => mergedPdf.addPage(p))
        loadedCount++
      } catch (e) {
        console.error(`[recompile-pdf] Error loading PDF for prestation ${row.id}:`, e.message)
        missing.push(row.id)
      }
    }

    if (loadedCount === 0) {
      return res.status(404).json({
        error: 'Aucun fichier PDF trouvé sur le serveur',
        detail: `${rows.length} prestations trouvées mais aucun fichier PDF accessible`,
        missing
      })
    }

    const mergedPdfBytes = await mergedPdf.save()
    const dateStr = new Date().toISOString().split('T')[0]
    const downloadName = `Compilation_Factures_${dateStr}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`)
    res.setHeader('X-Loaded-Count', loadedCount)
    res.setHeader('X-Missing-Count', missing.length)
    res.send(Buffer.from(mergedPdfBytes))
  } catch (err) {
    console.error('[recompile-pdf]', err)
    res.status(500).json({ error: err.message || 'Erreur interne' })
  }
}
