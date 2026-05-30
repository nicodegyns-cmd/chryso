// pages/api/admin/send-pdf-email.js
// Envoie un PDF compilé (déjà généré sur le serveur) à une adresse email

const fs = require('fs')
const path = require('path')
const { send } = require('../../../services/emailService')

export const config = {
  api: { responseLimit: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf_path, email_to, subject, message } = req.body || {}

  // Validate inputs
  if (!pdf_path || typeof pdf_path !== 'string') {
    return res.status(400).json({ error: 'pdf_path manquant' })
  }
  if (!email_to || typeof email_to !== 'string') {
    return res.status(400).json({ error: 'email_to manquant' })
  }

  // Validate email format (basic)
  const emailList = email_to.split(';').map(e => e.trim()).filter(Boolean)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const e of emailList) {
    if (!emailRegex.test(e)) {
      return res.status(400).json({ error: `Adresse email invalide : ${e}` })
    }
  }

  // Restrict pdf_path to public/exports/ to avoid path traversal
  const safeName = path.basename(pdf_path)
  if (!safeName.endsWith('.pdf')) {
    return res.status(400).json({ error: 'Le fichier doit être un PDF' })
  }
  const filePath = path.join(process.cwd(), 'public', 'exports', safeName)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier PDF introuvable sur le serveur' })
  }

  let pdfBuffer
  try {
    pdfBuffer = fs.readFileSync(filePath)
  } catch (e) {
    return res.status(500).json({ error: 'Impossible de lire le fichier PDF' })
  }

  try {
    const appName = process.env.APP_NAME || 'Fénix'
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    const emailSubject = subject || `Compilation de factures — ${dateStr}`

    const emailBody = message || `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 20px;">
      <h1 style="color: #0066cc; margin: 0; font-size: 26px;">📂 Compilation de factures</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">${appName} — ${dateStr}</p>
    </div>

    <p style="margin-top: 0; font-size: 15px;">Bonjour,</p>

    <p style="font-size: 15px;">Veuillez trouver ci-joint la compilation des factures générées pour la période sélectionnée.</p>

    <div style="background-color: #f0f7ff; border-left: 4px solid #0066cc; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #1e40af;">📎 Document joint</p>
      <p style="margin: 0; font-family: monospace; background-color: #ffffff; padding: 10px; border-radius: 4px; font-size: 13px; word-break: break-all; color: #374151;">${safeName}</p>
    </div>

    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #166534; font-size: 13px;">✅ Ce document contient l'ensemble des factures de la sélection exportée. Conservez-le pour votre comptabilité.</p>
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

    const result = await send({
      to: emailList.join(', '),
      subject: emailSubject,
      html: emailBody,
      attachments: [{
        filename: safeName,
        content: pdfBuffer,
      }],
    })

    if (!result.sent) {
      return res.status(500).json({ error: result.error || 'Échec de l\'envoi' })
    }

    return res.status(200).json({ success: true, message: `Email envoyé à ${emailList.join(', ')}` })
  } catch (err) {
    console.error('[send-pdf-email] Error:', err.message)
    return res.status(500).json({ error: `Erreur d'envoi : ${err.message}` })
  }
}
