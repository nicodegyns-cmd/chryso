// pages/api/admin/send-pdf-email.js
// Envoie un PDF compilé (déjà généré sur le serveur) à une adresse email

const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

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
    const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER && smtpPass ? {
        user: process.env.SMTP_USER,
        pass: smtpPass,
      } : undefined,
      tls: { rejectUnauthorized: false },
    })

    const emailSubject = subject || `Compilation de factures — ${new Date().toLocaleDateString('fr-FR')}`
    const emailBody = message ||
      `<p>Bonjour,</p>
       <p>Veuillez trouver ci-joint la compilation des factures générées.</p>
       <p>Cordialement,<br/>Système de gestion des factures</p>`

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@fenix.local',
      to: emailList.join(', '),
      subject: emailSubject,
      html: emailBody,
      attachments: [{
        filename: safeName,
        content: pdfBuffer,
      }],
    })

    return res.status(200).json({ success: true, message: `Email envoyé à ${emailList.join(', ')}` })
  } catch (err) {
    console.error('[send-pdf-email] Error:', err.message)
    return res.status(500).json({ error: `Erreur d'envoi : ${err.message}` })
  }
}
