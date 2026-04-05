/**
 * API Simple: Récupère les PDFs générés, les merge et envoie à la comptabilité
 * N'utilise que les PDFs déjà générés (pdf_url IS NOT NULL)
 * Ne touche PAS au code de génération PDF complexe
 */
const { getPool } = require('../../../../../services/db')
const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

export default async function handler(req, res) {
  const pool = getPool()
  const { id } = req.query

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).end('Method Not Allowed')
    }

    // === STEP 1: Get analytic details ===
    const [[analytic]] = await pool.query(
      'SELECT id, name, code FROM analytics WHERE id = $1',
      [id]
    )
    if (!analytic) {
      return res.status(404).json({ error: 'Analytic not found' })
    }

    // === STEP 2: Get all prestations with generated PDFs for this analytic ===
    const [prestations] = await pool.query(
      `SELECT id, date, invoice_number, request_ref, pdf_url 
       FROM prestations 
       WHERE analytic_id = $1 
         AND pdf_url IS NOT NULL 
         AND pdf_url != '' 
         AND status = 'En attente d\'envoie'
       ORDER BY date ASC`,
      [id]
    )

    if (!prestations || prestations.length === 0) {
      return res.status(404).json({ 
        error: 'No PDFs ready to send for this analytic' 
      })
    }

    // === STEP 3: Load and merge all PDF files ===
    const pdfDocs = []
    const basePath = path.join(process.cwd(), 'public')
    const dates = []
    const prestationIds = []

    for (const prestation of prestations) {
      const filePath = path.join(basePath, prestation.pdf_url.replace(/^\/+/, ''))

      if (!fs.existsSync(filePath)) {
        console.warn(`[send-merged-pdfs] PDF file not found: ${filePath}`)
        continue
      }

      try {
        const pdfBytes = fs.readFileSync(filePath)
        const doc = await PDFDocument.load(pdfBytes)
        pdfDocs.push(doc)
        prestationIds.push(prestation.id)
        if (prestation.date) {
          dates.push(new Date(prestation.date))
        }
      } catch (e) {
        console.error(`[send-merged-pdfs] Error loading PDF ${filePath}:`, e.message)
      }
    }

    if (pdfDocs.length === 0) {
      return res.status(404).json({ 
        error: 'No valid PDF files could be loaded' 
      })
    }

    // === STEP 4: Create merged PDF ===
    const mergedPdf = await PDFDocument.create()
    for (const doc of pdfDocs) {
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices())
      pages.forEach(page => {
        mergedPdf.addPage(page)
      })
    }

    const mergedPdfBytes = await mergedPdf.save()
    const filename = `Factures_${analytic.code || analytic.name || `Analytic_${id}`}_${new Date().toISOString().split('T')[0]}.pdf`

    // Save merged PDF to exports folder
    const exportDir = path.join(process.cwd(), 'public', 'exports')
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }
    const exportPath = path.join(exportDir, filename)
    fs.writeFileSync(exportPath, Buffer.from(mergedPdfBytes))
    const pdfUrl = `/exports/${filename}`

    // === STEP 5: Send email with merged PDF ===
    const recipientEmails = []
    if (process.env.INVOICE_RECIPIENT_EMAIL) {
      recipientEmails.push(
        ...process.env.INVOICE_RECIPIENT_EMAIL
          .split(';')
          .map(e => e.trim())
          .filter(e => e)
      )
    }

    const firstDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null
    const lastDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null

    let sendStatus = 'success'
    let errorMessage = null

    if (recipientEmails.length > 0) {
      try {
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
          to: recipientEmails.join(', '),
          subject: `Factures ${analytic.code || analytic.name} - ${new Date().toLocaleDateString('fr-FR')}`,
          html: `
            <p>Bonjour,</p>
            <p>Veuillez trouver ci-joint le document récapitulatif des factures pour <strong>${analytic.name || analytic.code}</strong>.</p>
            <p>
              <strong>Données du document :</strong><br/>
              Nombre de factures : ${prestationIds.length}<br/>
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
      } catch (emailErr) {
        console.error('[send-merged-pdfs] Email send error:', emailErr.message)
        sendStatus = 'partial'
        errorMessage = emailErr.message
      }
    } else {
      console.warn('[send-merged-pdfs] INVOICE_RECIPIENT_EMAIL not configured')
    }

    // === STEP 6: Update database - mark prestations as sent ===
    try {
      if (prestationIds.length > 0) {
        const placeholders = prestationIds.map((_, i) => `$${i + 1}`).join(',')
        await pool.query(
          `UPDATE prestations 
           SET status = 'Envoyé à la facturation', 
               sent_at = NOW()
           WHERE id IN (${placeholders})`,
          prestationIds
        )
      }
    } catch (dbErr) {
      console.warn('[send-merged-pdfs] Error updating prestations:', dbErr.message)
    }

    return res.status(200).json({
      success: true,
      message: recipientEmails.length > 0 
        ? 'Factures mergées et envoyées avec succès' 
        : 'Factures mergées (pas d\'email configuré)',
      filename: filename,
      pdfUrl: pdfUrl,
      prestationCount: prestationIds.length,
      recipients: recipientEmails,
      status: sendStatus,
      error: errorMessage
    })
  } catch (err) {
    console.error('[send-merged-pdfs] API error:', err)
    res.status(500).json({ 
      error: 'internal server error', 
      message: err.message 
    })
  }
}
