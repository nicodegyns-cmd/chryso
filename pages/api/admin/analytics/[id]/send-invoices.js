const { getPool } = require('../../../../../services/db')
const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

export default async function handler(req, res){
  const pool = getPool()
  const { id } = req.query

  try{
    if (req.method !== 'POST'){
      res.setHeader('Allow', 'POST')
      return res.status(405).end('Method Not Allowed')
    }

    // Get analytic details
    const [[analytic]] = await pool.query(
      'SELECT id, name as analytic_name, code as analytic_code FROM analytics WHERE id = ?',
      [id]
    )
    if (!analytic) return res.status(404).json({ error: 'Analytic not found' })

    // Get all prestations with a PDF file for this analytic
    const [prestations] = await pool.query(
      'SELECT id, date, invoice_number, request_ref, pdf_url FROM prestations WHERE analytic_id = ? AND pdf_url IS NOT NULL AND pdf_url != "" ORDER BY date ASC',
      [id]
    )

    if (!prestations || prestations.length === 0){
      return res.status(404).json({ error: 'No invoices with generated PDFs found for this analytic' })
    }

    // Collect all PDF files and metadata
    const pdfDocs = []
    const basePath = path.join(process.cwd(), 'public')
    const dates = []

    for (const prestation of prestations){
      if (!prestation.pdf_url) continue

      const filePath = path.join(basePath, prestation.pdf_url.replace(/^\/+/, ''))

      if (!fs.existsSync(filePath)){
        console.warn(`PDF file not found: ${filePath}`)
        continue
      }

      try{
        const pdfBytes = fs.readFileSync(filePath)
        const doc = await PDFDocument.load(pdfBytes)
        pdfDocs.push(doc)
        if (prestation.date) dates.push(new Date(prestation.date))
      }catch(e){
        console.error(`Error loading PDF ${filePath}:`, e.message)
      }
    }

    if (pdfDocs.length === 0){
      return res.status(404).json({ error: 'No PDF files could be loaded' })
    }

    // Create merged PDF
    const mergedPdf = await PDFDocument.create()
    for (const doc of pdfDocs){
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices())
      pages.forEach(page => {
        mergedPdf.addPage(page)
      })
    }

    const mergedPdfBytes = await mergedPdf.save()
    const filename = `Factures_${analytic.analytic_code || analytic.analytic_name || `Analytic_${id}`}_${new Date().toISOString().split('T')[0]}.pdf`

    // Save the merged PDF to exports folder
    const exportDir = path.join(process.cwd(), 'public', 'exports')
    if (!fs.existsSync(exportDir)){
      fs.mkdirSync(exportDir, { recursive: true })
    }
    const exportPath = path.join(exportDir, filename)
    fs.writeFileSync(exportPath, Buffer.from(mergedPdfBytes))
    const pdfUrl = `/exports/${filename}`

    // Get recipient emails from environment or use default test email
    const recipientEmails = []
    if (process.env.INVOICE_RECIPIENT_EMAIL){
      recipientEmails.push(...process.env.INVOICE_RECIPIENT_EMAIL.split(';').map(e => e.trim()).filter(e => e))
    } else {
      // No email configured - just log and save to DB without sending
      console.warn('INVOICE_RECIPIENT_EMAIL not configured, will save to history without sending')
    }

    // Calculate date range for all prestations
    const firstDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null
    const lastDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null

    // Send email if recipients exist
    let sendStatus = 'success'
    let errorMessage = null
    const actualRecipients = recipientEmails.length > 0 ? recipientEmails : []

    if (actualRecipients.length > 0){
      try{
        // Configure email transporter
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'localhost',
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          } : undefined
        })

        const mailOptions = {
          from: process.env.SMTP_FROM || 'noreply@fenix.local',
          to: actualRecipients.join(', '),
          subject: `Factures ${analytic.analytic_code || analytic.analytic_name} - ${new Date().toLocaleDateString('fr-FR')}`,
          html: `
            <p>Bonjour,</p>
            <p>Veuillez trouver ci-joint le document récapitulatif des factures pour <strong>${analytic.analytic_name || analytic.analytic_code}</strong>.</p>
            <p>
              <strong>Données du document :</strong><br/>
              Nombre de factures : ${prestations.length}<br/>
              Période : ${firstDate && lastDate ? `Du ${firstDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')}` : 'Non disponible'}
            </p>
            <p>Cordialement,<br/>Système de gestion des factures</p>
          `,
          attachments: [{
            filename: filename,
            content: Buffer.from(mergedPdfBytes)
          }]
        }

        await transporter.sendMail(mailOptions)
      }catch(emailErr){
        console.error('Email send error:', emailErr.message)
        sendStatus = 'partial'
        errorMessage = emailErr.message
      }
    }

    // Record the send in database
    try{
      const [insertResult] = await pool.execute(
        `INSERT INTO pdf_sends (analytic_id, analytic_code, analytic_name, recipient_emails, prestation_count, first_prestation_date, last_prestation_date, filename, status, error_message, sent_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          analytic.analytic_code || '',
          analytic.analytic_name || '',
          JSON.stringify(actualRecipients),
          prestations.length,
          firstDate ? firstDate.toISOString().split('T')[0] : null,
          lastDate ? lastDate.toISOString().split('T')[0] : null,
          pdfUrl,
          sendStatus,
          errorMessage,
          'admin'
        ]
      )
      
      // Mark prestations as sent by storing the batch ID and updating status
      const batchId = insertResult.insertId
      const prestationIds = prestations.map(p => p.id)
      if (prestationIds.length > 0 && batchId){
        const placeholders = prestationIds.map(() => '?').join(',')
        await pool.query(
          `UPDATE prestations SET sent_in_batch_id = ?, status = 'Envoyé à la facturation' WHERE id IN (${placeholders})`,
          [batchId, ...prestationIds]
        )
      }
    }catch(dbErr){
      console.warn('Error recording PDF send or marking prestations:', dbErr.message)
    }

    return res.status(200).json({
      success: true,
      message: actualRecipients.length > 0 ? 'PDF generated and sent successfully' : 'PDF generated but not sent (no recipients configured)',
      filename: filename,
      recipients: actualRecipients,
      prestationCount: prestations.length,
      status: sendStatus,
      error: errorMessage
    })
  }catch(err){
    console.error('send-invoices API error', err)
    res.status(500).json({ error: 'internal server error', message: err.message })
  }
}
