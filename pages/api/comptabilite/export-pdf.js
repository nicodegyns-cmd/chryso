// pages/api/comptabilite/export-pdf.js
import { getPool } from '../../../services/db'
import { PDFDocument, rgb } from 'pdf-lib'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const pool = getPool()
    
    // Support both GET and POST for flexibility
    const query = req.method === 'GET' ? req.query : req.body
    const { analytic_id, prestationIds } = query

    let sql = `
      SELECT 
        p.id,
        p.user_id,
        p.analytic_id,
        COALESCE(a.name, 'Non assigné') AS analytic_name,
        COALESCE(a.code, '') AS analytic_code,
        act.pay_type AS activity_type,
        COALESCE(p.remuneration_infi, p.remuneration_med) AS remuneration,
        p.date,
        p.status,
        u.first_name,
        u.last_name,
        u.email
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
      LEFT JOIN activities act ON p.activity_id = act.id
      WHERE 1=1
    `
    const params = []

    // Filter by specific prestation IDs if provided
    if (prestationIds && Array.isArray(prestationIds) && prestationIds.length > 0) {
      sql += ` AND p.id = ANY($${params.length + 1})`
      params.push(prestationIds)
    } else if (analytic_id) {
      // Filter by analytic_id as fallback
      sql += ` AND p.analytic_id = $${params.length + 1}`
      params.push(analytic_id)
    }

    // Apply status filter
    if (status) {
      if (status === 'sent_to_billing') {
        sql += ` AND p.status = $${params.length + 1}`
        params.push('Envoyé à la facturation')
      } else if (status === 'invoiced') {
        sql += ` AND p.status = $${params.length + 1}`
        params.push('Facturé')
      } else if (status === 'paid') {
        sql += ` AND p.status = $${params.length + 1}`
        params.push('Payé')
      }
    }

    sql += ` ORDER BY p.date DESC`

    const result = await pool.query(sql, params)
    const prestations = result.rows || []

    if (prestations.length === 0) {
      return res.status(400).json({ error: 'Aucune prestation trouvée' })
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create()
    const pageWidth = 595 // A4 width in points
    const pageHeight = 842 // A4 height in points
    const margin = 40
    const contentWidth = pageWidth - 2 * margin
    const colX = [margin, margin + 100, margin + 220, margin + 330, margin + 450]

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let yPosition = pageHeight - margin
    const helvetica = await pdfDoc.embedFont('Helvetica')
    const helveticaBold = await pdfDoc.embedFont('Helvetica-Bold')

    // Get analytic name
    const analyticName = prestations[0]?.analytic_name || 'Non assigné'

    // Title
    currentPage.drawText(`Factures - ${analyticName}`, {
      x: margin,
      y: yPosition,
      size: 18,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    })
    yPosition -= 30

    // Date
    const now = new Date().toLocaleDateString('fr-FR')
    currentPage.drawText(`Généré le: ${now}`, {
      x: margin,
      y: yPosition,
      size: 10,
      font: helvetica,
      color: rgb(100, 100, 100)
    })
    yPosition -= 20

    // Column headers
    const headers = ['Prestataire', 'Activité', 'Date', 'Montant', 'Statut']
    const headerY = yPosition

    // Draw header background
    currentPage.drawRectangle({
      x: margin,
      y: headerY - 14,
      width: contentWidth,
      height: 14,
      color: rgb(0, 100, 150)
    })

    // Draw header text
    headers.forEach((header, i) => {
      currentPage.drawText(header, {
        x: colX[i],
        y: headerY - 11,
        size: 9,
        font: helveticaBold,
        color: rgb(255, 255, 255)
      })
    })

    yPosition -= 20

    // Data rows
    let subtotal = 0
    prestations.forEach((item, idx) => {
      if (yPosition < margin + 60) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
        yPosition = pageHeight - margin - 20
      }

      const userData = `${item.first_name || ''} ${item.last_name || ''}`.substring(0, 18).trim()
      const activityType = (item.activity_type || '').substring(0, 16)
      const dateStr = new Date(item.date).toLocaleDateString('fr-FR')
      const amount = parseFloat(item.remuneration || 0).toFixed(2)
      const statusLabel = (item.status || 'Inconnu').substring(0, 12)

      // Alternate row background
      if (idx % 2 === 0) {
        currentPage.drawRectangle({
          x: margin,
          y: yPosition - 12,
          width: contentWidth,
          height: 12,
          color: rgb(240, 245, 250)
        })
      }

      // Draw row data
      currentPage.drawText(userData, { x: colX[0], y: yPosition - 9, size: 8, font: helvetica })
      currentPage.drawText(activityType, { x: colX[1], y: yPosition - 9, size: 8, font: helvetica })
      currentPage.drawText(dateStr, { x: colX[2], y: yPosition - 9, size: 8, font: helvetica })
      currentPage.drawText(`${amount} €`, { x: colX[3], y: yPosition - 9, size: 8, font: helvetica })
      currentPage.drawText(statusLabel, { x: colX[4], y: yPosition - 9, size: 8, font: helvetica })

      subtotal += parseFloat(amount)
      yPosition -= 12
    })

    // Subtotal line
    yPosition -= 6
    currentPage.drawRectangle({
      x: margin,
      y: yPosition - 12,
      width: contentWidth,
      height: 12,
      color: rgb(200, 220, 240)
    })
    currentPage.drawText(`Total ${analyticName}:`, {
      x: colX[1],
      y: yPosition - 9,
      size: 9,
      font: helveticaBold
    })
    currentPage.drawText(`${subtotal.toFixed(2)} €`, {
      x: colX[3],
      y: yPosition - 9,
      size: 9,
      font: helveticaBold
    })

    // Generate PDF buffer
    const pdfBytes = await pdfDoc.save()

    // Send as download
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="analytique-${analyticName.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf"`)
    res.send(Buffer.from(pdfBytes))
  } catch (err) {
    console.error('[export-pdf]', err)
    res.status(500).json({ error: err.message })
  }
}

