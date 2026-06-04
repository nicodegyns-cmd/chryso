// pages/api/admin/send-invoice-email.js
// Envoie la facture PDF d'une prestation individuelle par email

const { getPool } = require('../../../services/db')
const { send } = require('../../../services/emailService')
const fs = require('fs')
const path = require('path')

export const config = {
  api: { responseLimit: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prestation_id, email_to, subject } = req.body || {}

  if (!prestation_id) return res.status(400).json({ error: 'prestation_id manquant' })
  if (!email_to || typeof email_to !== 'string') return res.status(400).json({ error: 'email_to manquant' })

  const emailList = email_to.split(';').map(e => e.trim()).filter(Boolean)
  if (emailList.length === 0) return res.status(400).json({ error: 'Aucune adresse email fournie' })
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const e of emailList) {
    if (!emailRegex.test(e)) return res.status(400).json({ error: `Adresse email invalide : ${e}` })
  }

  const pool = getPool()

  // Get prestation + user + analytic info
  const result = await pool.query(
    `SELECT p.id, p.pdf_url, p.invoice_number,
            u.first_name, u.last_name,
            an.name AS analytic_name
     FROM prestations p
     LEFT JOIN users u ON p.user_id = u.id
     LEFT JOIN analytics an ON p.analytic_id = an.id
     WHERE p.id = $1`,
    [prestation_id]
  )

  const row = result.rows[0]
  if (!row) return res.status(404).json({ error: 'Prestation introuvable' })
  if (!row.pdf_url) return res.status(400).json({ error: 'Aucun PDF généré pour cette prestation' })

  // Extract filename from pdf_url
  // Handles: /api/exports/download?file=xxx.pdf  OR  /exports/xxx.pdf
  let filename
  try {
    if (row.pdf_url.includes('?file=')) {
      const u = new URL(row.pdf_url, 'http://localhost')
      filename = path.basename(decodeURIComponent(u.searchParams.get('file') || ''))
    } else {
      filename = path.basename(row.pdf_url)
    }
  } catch (e) {
    filename = path.basename(row.pdf_url)
  }

  if (!filename || !filename.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Impossible de déterminer le fichier PDF depuis ' + row.pdf_url })
  }

  const filePath = path.join(process.cwd(), 'public', 'exports', filename)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier PDF introuvable sur le serveur : ' + filename })
  }

  let pdfBuffer
  try {
    pdfBuffer = fs.readFileSync(filePath)
  } catch (e) {
    return res.status(500).json({ error: 'Impossible de lire le fichier PDF' })
  }

  const appName = process.env.APP_NAME || 'Fénix'
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const invoiceRef = row.invoice_number || `#${row.id}`
  const recipientName = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Prestataire'
  const analyticLabel = row.analytic_name ? ` — ${row.analytic_name}` : ''
  const emailSubject = subject || `Facture ${invoiceRef}${analyticLabel} — ${dateStr}`

  const emailBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 20px;">
      <h1 style="color: #0066cc; margin: 0; font-size: 26px;">📄 Facture</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">${appName} — ${dateStr}</p>
    </div>

    <p style="margin-top: 0; font-size: 15px;">Bonjour,</p>
    <p style="font-size: 15px;">Veuillez trouver ci-joint la facture <strong>${invoiceRef}</strong> pour <strong>${recipientName}</strong>${analyticLabel}.</p>

    <div style="background-color: #f0f7ff; border-left: 4px solid #0066cc; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #1e40af;">📎 Document joint</p>
      <p style="margin: 0; font-family: monospace; background-color: #ffffff; padding: 10px; border-radius: 4px; font-size: 13px; word-break: break-all; color: #374151;">${filename}</p>
    </div>

    <p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
      Cet email a été envoyé automatiquement par le système de gestion ${appName}.<br/>
      Veuillez ne pas répondre directement à cet email.
    </p>

    <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
      <p style="margin: 4px 0;">© ${new Date().getFullYear()} ${appName}. Tous droits réservés.</p>
    </div>

  </div>
</body>
</html>`.trim()

  try {
    const sendResult = await send({
      to: emailList.join(', '),
      subject: emailSubject,
      html: emailBody,
      attachments: [{ filename, content: pdfBuffer }],
    })

    if (!sendResult.sent) {
      return res.status(500).json({ error: sendResult.error || "Échec de l'envoi" })
    }

    // Mark prestation as sent
    await pool.query(
      `UPDATE prestations SET status = 'Envoyé à la facturation' WHERE id = $1`,
      [prestation_id]
    )

    return res.status(200).json({ success: true, message: `Facture ${invoiceRef} envoyée à ${emailList.join(', ')}` })
  } catch (err) {
    console.error('[send-invoice-email] Error:', err.message)
    return res.status(500).json({ error: `Erreur d'envoi : ${err.message}` })
  }
}
