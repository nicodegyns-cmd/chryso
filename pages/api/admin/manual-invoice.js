// pages/api/admin/manual-invoice.js
// Crée une facture manuelle à partir des paramètres fournis par l'admin :
// utilisateur, activité/analytique, date, heures de garde, heures de sortie, heures supplémentaires

const { getPool } = require('../../../services/db')
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

export const config = {
  api: { responseLimit: false },
  maxDuration: 120,
}

function fmt(n) {
  return Number(n).toFixed(2).replace('.', ',')
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildInvoiceHtml({ logoDataUri, userName, userAddress, userBce, userAccount, invoiceNumber, invoiceDate, tableBodyHtml, grandTotal, analyticRef, analyticAccount, dateMin, dateMax }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FACTURE — ${invoiceNumber}</title>
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; font-size: 12px; margin: 28px }
      .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px }
      .left-brand { display: flex; flex-direction: column; gap: 8px; align-items: flex-start }
      .logo-wrap { width: 200px; height: 200px; display: flex; align-items: center; justify-content: center }
      .logo-wrap img { max-width: 180px; max-height: 180px; width: auto; height: auto; object-fit: contain }
      .provider .name { font-weight: 800; font-size: 18px }
      .provider .meta { color: #444; margin-top: 4px }
      .right-meta { text-align: right }
      .invoice-title { font-size: 26px; font-weight: 800; letter-spacing: 0.6px }
      .invoice-ref { color: #444; margin-top: 6px }
      .right-column { display: flex; flex-direction: column; align-items: flex-end }
      .invoice-meta-box { border: 1px solid #ccc; border-radius: 6px; padding: 12px 18px; margin-top: 8px; min-width: 220px }
      .invoice-meta-box table { width: 100%; border-collapse: collapse }
      .invoice-meta-box td { padding: 3px 0; font-size: 12px }
      .invoice-meta-box td:first-child { color: #666; padding-right: 10px }
      .invoice-meta-box td:last-child { font-weight: 700; text-align: right }
      hr.divider { border: none; border-top: 1px solid #e5e5e5; margin: 18px 0 }
      .client-section { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 18px }
      .client-box { padding: 14px 18px; border: 1px solid #ddd; border-radius: 6px; min-width: 200px }
      .client-box h4 { margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px }
      .client-box p { margin: 2px 0; font-size: 12px }
      .client-box .entity-name { font-weight: 700; font-size: 14px }
      table.items { width: 100%; border-collapse: collapse; margin-top: 20px }
      table.items thead tr { background: #1e293b; color: #fff }
      table.items thead th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px }
      table.items thead th:last-child { text-align: right }
      table.items tbody tr:nth-child(even) { background: #f8fafc }
      table.items tbody td { padding: 9px 12px; font-size: 12px; border-bottom: 1px solid #e2e8f0 }
      table.items tbody td:last-child { text-align: right; font-weight: 600 }
      table.items tr.analytic-header td { background: #e0f2fe; font-weight: 700; padding: 8px 12px; border-bottom: 1px solid #bae6fd }
      table.items tr.subtotal td { background: #f0fdf4; font-style: italic; border-top: 1px solid #bbf7d0 }
      .total-box { margin-top: 24px; display: flex; justify-content: flex-end }
      .total-box table { min-width: 280px; border-collapse: collapse }
      .total-box td { padding: 6px 12px; font-size: 13px }
      .total-box tr.grand { background: #1e293b; color: #fff }
      .total-box tr.grand td { font-size: 15px; font-weight: 700 }
      .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e5e5; color: #888; font-size: 10px; text-align: center }
      .manual-badge { display: inline-block; background: #fef9c3; color: #854d0e; border: 1px solid #fde047; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 600; margin-bottom: 6px }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="left-brand">
        <div class="logo-wrap"><img src="${logoDataUri}" alt="Logo" /></div>
        <div class="provider">
          <div class="name">${escHtml(userName)}</div>
          <div class="meta">
            ${userAddress ? `<div>📍 ${escHtml(userAddress)}</div>` : ''}
            ${userBce ? `<div>BCE: ${escHtml(userBce)}</div>` : ''}
            ${userAccount ? `<div>IBAN: ${escHtml(userAccount)}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="right-column">
        <div class="invoice-title">FACTURE</div>
        <div class="invoice-ref">${escHtml(invoiceNumber)}</div>
        <span class="manual-badge">⚡ Facture manuelle</span>
        <div class="invoice-meta-box">
          <table>
            <tr><td>Date facture</td><td>${escHtml(invoiceDate)}</td></tr>
            <tr><td>Période</td><td>${escHtml(dateMin)}${dateMin !== dateMax ? ' → ' + escHtml(dateMax) : ''}</td></tr>
            ${analyticRef ? `<tr><td>Analytique</td><td>${escHtml(analyticRef)}</td></tr>` : ''}
            ${analyticAccount ? `<tr><td>Compte</td><td>${escHtml(analyticAccount)}</td></tr>` : ''}
          </table>
        </div>
      </div>
    </div>
    <hr class="divider" />
    <table class="items">
      <thead>
        <tr>
          <th style="width:50%">Description</th>
          <th>Quantité</th>
          <th>Prix unit.</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${tableBodyHtml}
      </tbody>
    </table>
    <div class="total-box">
      <table>
        <tr><td style="text-align:right">Sous-total HTVA</td><td style="text-align:right;font-weight:600">${fmt(grandTotal)} €</td></tr>
        <tr><td style="text-align:right">TVA (0%)</td><td style="text-align:right">0,00 €</td></tr>
        <tr class="grand"><td style="text-align:right">TOTAL DÛ</td><td style="text-align:right">${fmt(grandTotal)} €</td></tr>
      </table>
    </div>
    <div class="footer">
      Facture générée manuellement par l'administration — Med Team · Tous droits réservés
    </div>
  </body>
</html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let browser = null
  try {
    const pool = getPool()
    const {
      user_id,
      analytic_id,
      activity_label,   // description libre de l'activité
      date,             // date de la prestation (YYYY-MM-DD)
      garde_hours,
      sortie_hours,
      overtime_hours,
      unit_price,       // prix unitaire (€/h)
      comments,
    } = req.body || {}

    // Validation des champs obligatoires
    if (!user_id) return res.status(400).json({ error: 'user_id est requis' })
    if (!date) return res.status(400).json({ error: 'La date de prestation est requise' })
    if (!unit_price || Number(unit_price) <= 0) return res.status(400).json({ error: 'Le prix unitaire doit être positif' })

    const gardeH = Number(garde_hours) || 0
    const sortieH = Number(sortie_hours) || 0
    const overtimeH = Number(overtime_hours) || 0

    if (gardeH + sortieH === 0) {
      return res.status(400).json({ error: 'Au moins des heures de garde ou de sortie sont requises' })
    }

    // Récupérer les informations de l'utilisateur
    const userQ = await pool.query(
      'SELECT id, email, role, first_name, last_name, telephone, address, bce, company, account FROM users WHERE id = $1',
      [user_id]
    )
    const userRows = userQ.rows || []
    if (!userRows.length) return res.status(404).json({ error: 'Utilisateur introuvable' })
    const user = userRows[0]

    // Récupérer les informations de l'analytique (si fourni)
    let analytic = null
    if (analytic_id) {
      const anQ = await pool.query(
        'SELECT id, name, analytic_type, code, entite, account_number FROM analytics WHERE id = $1',
        [analytic_id]
      )
      const anRows = anQ.rows || []
      if (anRows.length) analytic = anRows[0]
    }

    // Calculer le tarif et la rémunération
    const unitPriceNum = Number(unit_price)
    const isMed = (user.role || '').toUpperCase().includes('MED')

    const baseHours = gardeH + sortieH
    const totalRemuneration = +(
      unitPriceNum * gardeH +
      unitPriceNum * sortieH +
      unitPriceNum * overtimeH
    ).toFixed(2)

    // Numéro de facture
    const year = new Date().getFullYear()
    const invoiceDate = new Date().toLocaleDateString('fr-FR')
    const maxInvRes = await pool.query(
      `SELECT invoice_number FROM prestations
       WHERE invoice_number LIKE $1
       ORDER BY CAST(SPLIT_PART(invoice_number, '-', 2) AS INTEGER) DESC
       LIMIT 1`,
      [`${year}-%`]
    )
    let nextNum = 1
    const invRows = maxInvRes.rows || []
    if (invRows.length > 0 && invRows[0].invoice_number) {
      const parts = String(invRows[0].invoice_number).split('-')
      const n = parseInt(parts[1] || '0', 10)
      if (!isNaN(n)) nextNum = n + 1
    }
    const invoiceNumber = `${year}-${String(nextNum).padStart(5, '0')}`

    // Insérer la prestation en base
    const insertQ = await pool.query(
      `INSERT INTO prestations
        (user_id, analytic_id, date, garde_hours, sortie_hours, overtime_hours,
         remuneration_infi, remuneration_med, status, pay_type, comments, invoice_number, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Facturé', 'Manuel', $9, $10, NOW())
       RETURNING id`,
      [
        user_id,
        analytic_id || null,
        date,
        gardeH,
        sortieH,
        overtimeH,
        isMed ? 0 : totalRemuneration,
        isMed ? totalRemuneration : 0,
        comments || null,
        invoiceNumber,
      ]
    )
    const insertedId = (insertQ.rows && insertQ.rows[0]) ? insertQ.rows[0].id : null

    // Construire le HTML de facture
    const userName = user.company || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
    const prestDate = new Date(date).toLocaleDateString('fr-FR')
    const activityLabel = activity_label || analytic?.name || 'Prestation'

    let tableBodyHtml = ''
    let grandTotal = 0

    const analyticKey = analytic?.name || 'Non assigné'
    tableBodyHtml += `<tr class="analytic-header"><td colspan="4"><strong>📊 ${escHtml(analyticKey)}</strong></td></tr>`

    let analyticTotal = 0
    const codeRef = insertedId ? `#${insertedId}` : 'MANUEL'

    if (gardeH > 0) {
      const gAmt = +(unitPriceNum * gardeH).toFixed(2)
      tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${escHtml(activityLabel)} / Garde</td><td>${gardeH}</td><td>${fmt(unitPriceNum)}€</td><td>${fmt(gAmt)}€</td></tr>`
      analyticTotal += gAmt
    }
    if (sortieH > 0) {
      const sAmt = +(unitPriceNum * sortieH).toFixed(2)
      tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${escHtml(activityLabel)} / Sortie</td><td>${sortieH}</td><td>${fmt(unitPriceNum)}€</td><td>${fmt(sAmt)}€</td></tr>`
      analyticTotal += sAmt
    }
    if (overtimeH > 0) {
      const oAmt = +(unitPriceNum * overtimeH).toFixed(2)
      tableBodyHtml += `<tr><td>Heures supplémentaires — ${prestDate} — ${escHtml(activityLabel)}</td><td>${overtimeH}</td><td>${fmt(unitPriceNum)}€</td><td>${fmt(oAmt)}€</td></tr>`
      analyticTotal += oAmt
    }

    tableBodyHtml += `
      <tr class="subtotal">
        <td colspan="3" style="text-align:right;font-style:italic">Sous-total ${escHtml(analyticKey)}</td>
        <td><strong>${fmt(analyticTotal)}€</strong></td>
      </tr>`
    grandTotal = analyticTotal

    // Logo
    let logoDataUri = null
    try {
      const candidates = [
        path.join(process.cwd(), 'public', 'assets', 'med team logo.png'),
        path.join(process.cwd(), 'public', 'assets', 'logo.png'),
      ]
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          const buf = fs.readFileSync(c)
          const ext = path.extname(c).toLowerCase()
          const mime = ext === '.svg' ? 'image/svg+xml' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png')
          logoDataUri = `data:${mime};base64,${buf.toString('base64')}`
          break
        }
      }
    } catch (e) { /* ignore */ }
    const fallbackLogo = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='76' height='76'><circle cx='38' cy='38' r='36' fill='%23fff' stroke='%23e33' stroke-width='6'/><text x='50%' y='52%' font-size='28' text-anchor='middle' fill='%23e33' font-family='Arial' dy='.3em'>+</text></svg>`

    const analyticRef = analytic
      ? [analytic.name, analytic.analytic_type, analytic.code, analytic.entite].filter(Boolean).join('-')
      : ''

    const html = buildInvoiceHtml({
      logoDataUri: logoDataUri || fallbackLogo,
      userName,
      userAddress: user.address || '',
      userBce: user.bce || '',
      userAccount: user.account || '',
      invoiceNumber,
      invoiceDate,
      tableBodyHtml,
      grandTotal,
      analyticRef,
      analyticAccount: analytic?.account_number || '',
      dateMin: prestDate,
      dateMax: prestDate,
    })

    // Générer le PDF avec Puppeteer
    const exportsDir = path.join(process.cwd(), 'public', 'exports')
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true })

    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
    await page.close()
    await browser.close()
    browser = null

    // Sauvegarder le PDF
    const safeName = userName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    const filename = `facture-${invoiceNumber}-${safeName}-${Date.now()}.pdf`
    const filePath = path.join(exportsDir, filename)
    fs.writeFileSync(filePath, pdfBuffer)
    const pdfUrl = `/api/exports/download?file=${encodeURIComponent(filename)}`

    // Mettre à jour la prestation avec l'URL du PDF
    if (insertedId) {
      await pool.query(
        'UPDATE prestations SET pdf_url = $1 WHERE id = $2',
        [pdfUrl, insertedId]
      )
    }

    // Retourner le PDF en téléchargement
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="facture-${invoiceNumber}.pdf"`)
    res.send(Buffer.from(pdfBuffer))
  } catch (err) {
    if (browser) { try { await browser.close() } catch (e) { /* ignore */ } }
    console.error('[manual-invoice]', err)
    res.status(500).json({ error: err.message || 'Erreur interne' })
  }
}
