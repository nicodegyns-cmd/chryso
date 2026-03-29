const { getPool } = require('../../../../../services/db')
const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

export default async function handler(req, res){
  const pool = getPool()
  const { id } = req.query

  try{
    if (req.method !== 'POST'){
      res.setHeader('Allow', 'POST')
      return res.status(405).end('Method Not Allowed')
    }

    // Get analytic details (id is now the analytic_id)
    const result_analytic_outer = await pool.query(
      'SELECT id, name as analytic_name, code as analytic_code FROM analytics WHERE id = ?',
      [id]
    )
    if (!analytic) return res.status(404).json({ error: 'Analytic not found' })

    // Get all prestations with a PDF file for this analytic
    const q_prestations = await pool.query(
      'SELECT id, invoice_number, request_ref, pdf_url FROM prestations WHERE analytic_id = ? AND pdf_url IS NOT NULL AND pdf_url != "" ORDER BY id ASC',
      [id]
    )

    if (!prestations || prestations.length === 0){
      return res.status(404).json({ error: 'No invoices with generated PDFs found for this analytic' })
    }

    // Collect all PDF files
    const pdfDocs = []
    const basePath = path.join(process.cwd(), 'public')

    for (const prestation of prestations){
      if (!prestation.pdf_url) continue

      // Parse the pdf_url to get the file path
      // pdf_url is typically something like '/exports/prestation_123.pdf'
      const filePath = path.join(basePath, prestation.pdf_url.replace(/^\/+/, ''))

      if (!fs.existsSync(filePath)){
        console.warn(`PDF file not found: ${filePath}`)
        continue
      }

      try{
        const pdfBytes = fs.readFileSync(filePath)
        const doc = await PDFDocument.load(pdfBytes)
        pdfDocs.push(doc)
      }catch(e){
        console.error(`Error loading PDF ${filePath}:`, e.message)
      }
    }

    if (pdfDocs.length === 0){
      return res.status(404).json({ error: 'No PDF files could be loaded' })
    }

    // Create a new PDF document to merge all PDFs into
    const mergedPdf = await PDFDocument.create()

    // Copy all pages from all PDFs into the merged document
    for (const doc of pdfDocs){
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices())
      pages.forEach(page => {
        mergedPdf.addPage(page)
      })
    }

    // Generate PDF bytes
    const mergedPdfBytes = await mergedPdf.save()

    // Set response headers for PDF download
    const filename = `Factures_${analytic.analytic_code || analytic.analytic_name || `Analytic_${id}`}_${new Date().toISOString().split('T')[0]}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.setHeader('Content-Length', mergedPdfBytes.length)

    return res.status(200).send(Buffer.from(mergedPdfBytes))
  }catch(err){
    console.error('generate-pdf API error', err)
    res.status(500).json({ error: 'internal server error', message: err.message })
  }
}
