// pages/api/comptabilite/export-pdf.js
// Fusionne les PDFs de factures existants (pdf_url) en un seul fichier téléchargeable
const { getPool } = require('../../../services/db')
const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()
    const { prestationIds, analytic_id, analyticName } = req.body

    if (!prestationIds || !Array.isArray(prestationIds) || prestationIds.length === 0) {
      return res.status(400).json({ error: 'prestationIds requis' })
    }

    // Récupère les pdf_url des prestations demandées
    const result = await pool.query(
      `SELECT id, pdf_url FROM prestations WHERE id = ANY($1) AND pdf_url IS NOT NULL AND pdf_url != '' ORDER BY date ASC`,
      [prestationIds]
    )
    const rows = result.rows || []

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Aucune facture PDF trouvée pour ces prestations. Les PDFs doivent être générés d\'abord.' })
    }

    // Charge et fusionne tous les PDFs
    const basePath = path.join(process.cwd(), 'public')
    const mergedPdf = await PDFDocument.create()
    let loaded = 0

    for (const row of rows) {
      const filePath = path.join(basePath, row.pdf_url.replace(/^\/+/, ''))
      if (!fs.existsSync(filePath)) {
        console.warn(`[export-pdf] Fichier manquant: ${filePath}`)
        continue
      }
      try {
        const pdfBytes = fs.readFileSync(filePath)
        const doc = await PDFDocument.load(pdfBytes)
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices())
        pages.forEach(page => mergedPdf.addPage(page))
        loaded++
      } catch (e) {
        console.error(`[export-pdf] Erreur chargement ${filePath}:`, e.message)
      }
    }

    if (loaded === 0) {
      return res.status(404).json({ error: 'Impossible de charger les fichiers PDF. Vérifiez que les PDFs sont bien générés.' })
    }

    const mergedPdfBytes = await mergedPdf.save()
    const safeName = (analyticName || analytic_id || 'export').toString().replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `Factures_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(Buffer.from(mergedPdfBytes))
  } catch (err) {
    console.error('[export-pdf]', err)
    res.status(500).json({ error: err.message })
  }
}

