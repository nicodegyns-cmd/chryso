// pages/api/comptabilite/export-all-pdf.js
// Génère une facture par utilisateur (avec toutes ses prestations groupées par analytique),
// fusionne tout en un seul PDF de compilation, marque les prestations comme "Facturé"

const { getPool } = require('../../../services/db')
const { PDFDocument } = require('pdf-lib')
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

// Augmenter le timeout Vercel pour ce endpoint lourd
export const config = {
  api: { responseLimit: false },
  maxDuration: 120,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let browser = null
  try {
    const pool = getPool()
    const { analytic_id, analyticName } = req.body || {}

    // 1. Récupérer les prestations "sent_to_billing" — filtrées par analytique si fourni
    const queryParams = []
    let analyticFilter = ''
    if (analytic_id != null) {
      queryParams.push(analytic_id)
      analyticFilter = `AND p.analytic_id = $${queryParams.length}`
    }
    queryParams.push('sent_to_billing')
    const statusParam = `$${queryParams.length}`

    const result = await pool.query(`
      SELECT
        p.*,
        u.email          AS user_email,
        u.role           AS user_role,
        u.first_name     AS user_first_name,
        u.last_name      AS user_last_name,
        u.telephone      AS user_phone,
        u.address        AS user_address,
        u.bce            AS user_bce,
        u.company        AS company_name,
        u.account        AS user_account,
        an.name          AS analytic_name,
        an.code          AS analytic_code,
        an.entite        AS analytic_entite,
        an.analytic_type AS analytic_identifier,
        an.account_number AS analytic_account_number
      FROM prestations p
      LEFT JOIN users u  ON p.user_id   = u.id
      LEFT JOIN analytics an ON p.analytic_id = an.id
      WHERE p.status = ${statusParam} ${analyticFilter}
      ORDER BY p.user_id, p.analytic_id NULLS LAST, p.date ASC
    `, queryParams)
    const rows = result.rows || []

    if (rows.length === 0) {
      const scope = analyticName ? `pour l'analytique "${analyticName}"` : ''
      return res.status(404).json({ error: `Aucune prestation à facturer (statut "sent_to_billing") ${scope}`.trim() })
    }

    // 2. Grouper par user_id
    const userMap = new Map()
    for (const row of rows) {
      const uid = row.user_id
      if (!userMap.has(uid)) userMap.set(uid, [])
      userMap.get(uid).push(row)
    }

    // 3. Charger le logo en base64
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

    // 4. Préparer le numéro de facture (séquence annuelle)
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

    // 5. Dossier de sauvegarde
    const exportsDir = path.join(process.cwd(), 'public', 'exports')
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true })

    // 6. Lancer Puppeteer et pdf-lib
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const mergedPdf = await PDFDocument.create()
    const allIds = rows.map(r => r.id)
    let invCounter = nextNum

    for (const [, userPrestations] of userMap) {
      const first = userPrestations[0]
      const userName = first.company_name ||
        `${first.user_first_name || ''} ${first.user_last_name || ''}`.trim() ||
        first.user_email || 'Fournisseur'
      const invoiceNumber = `${year}-${String(invCounter++).padStart(5, '0')}`

      // Grouper les prestations par analytique au sein de l'utilisateur
      const analyticMap = new Map()
      for (const p of userPrestations) {
        const key = p.analytic_id != null ? String(p.analytic_id) : 'unassigned'
        if (!analyticMap.has(key)) {
          analyticMap.set(key, {
            name: p.analytic_name || 'Non assigné',
            account: p.analytic_account_number || '',
            items: [],
          })
        }
        analyticMap.get(key).items.push(p)
      }

      // Construire le HTML de la table
      let tableBodyHtml = ''
      let grandTotal = 0

      for (const [, ag] of analyticMap) {
        tableBodyHtml += `
          <tr class="analytic-header">
            <td colspan="4"><strong>📊 ${escHtml(ag.name)}</strong></td>
          </tr>`

        let analyticTotal = 0

        for (const p of ag.items) {
          const isMed = (p.user_role || '').toUpperCase().includes('MED')
          const totalAmt = isMed
            ? Number(p.remuneration_med || p.remuneration_infi || p.remuneration || 0)
            : Number(p.remuneration_infi || p.remuneration_med || p.remuneration || 0)

          const gardeH = Number(p.garde_hours || 0)
          const sortieH = Number(p.sortie_hours || 0)
          const overtimeH = Number(p.overtime_hours || 0)
          const expenses = Number(p.expense_amount || 0)
          const prestDate = p.date ? new Date(p.date).toLocaleDateString('fr-FR') : invoiceDate
          const codeRef = escHtml(p.ebrigade_activity_code || p.request_ref || ('#' + p.id))
          const payType = escHtml(p.pay_type || '')
          const ebrigadeName = escHtml(p.ebrigade_activity_name || '')
          // Suffixe analytique eBrigade affiché après le code de référence
          const ebrigadeSuffix = ebrigadeName ? ` | ${ebrigadeName}` : ''

          // Prix unitaire déduit du total / heures
          const baseHours = gardeH + sortieH || Number(p.hours_actual || 1)
          const unitPrice = baseHours > 0 ? Number((totalAmt / baseHours).toFixed(2)) : totalAmt

          if (gardeH > 0 || sortieH > 0) {
            if (gardeH > 0) {
              const gAmt = +(unitPrice * gardeH).toFixed(2)
              tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix} / Garde</td><td>${gardeH}</td><td>${fmt(unitPrice)}€</td><td>${fmt(gAmt)}€</td></tr>`
              analyticTotal += gAmt
            }
            if (sortieH > 0) {
              const sAmt = +(unitPrice * sortieH).toFixed(2)
              tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix} / Sortie</td><td>${sortieH}</td><td>${fmt(unitPrice)}€</td><td>${fmt(sAmt)}€</td></tr>`
              analyticTotal += sAmt
            }
            if (overtimeH > 0) {
              const oAmt = +(unitPrice * overtimeH).toFixed(2)
              tableBodyHtml += `<tr><td>Heures supplémentaires — ${prestDate} — ${codeRef}${ebrigadeSuffix}</td><td>${overtimeH}</td><td>${fmt(unitPrice)}€</td><td>${fmt(oAmt)}€</td></tr>`
              analyticTotal += oAmt
            }
          } else {
            const qty = Number(p.hours_actual || p.garde_hours || 1)
            const lineAmt = +totalAmt.toFixed(2)
            tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix}${payType ? ' / ' + payType : ''}</td><td>${qty}</td><td>${fmt(unitPrice)}€</td><td>${fmt(lineAmt)}€</td></tr>`
            analyticTotal += lineAmt
          }

          if (expenses > 0) {
            const expComment = escHtml(p.expense_comment || '')
            tableBodyHtml += `<tr><td>Note de frais${expComment ? ' — ' + expComment : ''}</td><td></td><td></td><td>${fmt(expenses)}€</td></tr>`
            analyticTotal += expenses
          }
        }

        grandTotal += analyticTotal
        tableBodyHtml += `
          <tr class="subtotal">
            <td colspan="3" style="text-align:right; font-style:italic">Sous-total ${escHtml(ag.name)}</td>
            <td><strong>${fmt(analyticTotal)}€</strong></td>
          </tr>`
      }

      // HTML complet pour cet utilisateur
      const html = buildInvoiceHtml({
        logoDataUri: logoDataUri || fallbackLogo,
        userName,
        userAddress: first.user_address || '',
        userBce: first.user_bce || '',
        userAccount: first.user_account || '',
        invoiceNumber,
        invoiceDate,
        tableBodyHtml,
        grandTotal,
      })

      // Rendu Puppeteer
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
      await page.close()

      // Sauvegarder le PDF individuel
      const safeName = userName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
      const userFilename = `facture-${invoiceNumber}-${safeName}-${Date.now()}.pdf`
      const userFilePath = path.join(exportsDir, userFilename)
      fs.writeFileSync(userFilePath, pdfBuffer)
      const userPdfUrl = `/api/exports/download?file=${encodeURIComponent(userFilename)}`

      // Fusionner dans le PDF global
      const userDoc = await PDFDocument.load(pdfBuffer)
      const pages = await mergedPdf.copyPages(userDoc, userDoc.getPageIndices())
      pages.forEach(p => mergedPdf.addPage(p))

      // Mettre à jour en base : invoice_number + pdf_url individuel
      await pool.query(
        `UPDATE prestations SET invoice_number = $1, pdf_url = $2 WHERE id = ANY($3)`,
        [invoiceNumber, userPdfUrl, userPrestations.map(p => p.id)]
      )
    }

    await browser.close()
    browser = null

    // 7. Sauvegarder la compilation globale
    const mergedPdfBytes = await mergedPdf.save()
    const dateStr = new Date().toISOString().split('T')[0]
    const compilationFilename = `Compilation_Factures_${dateStr}-${Date.now()}.pdf`
    fs.writeFileSync(path.join(exportsDir, compilationFilename), Buffer.from(mergedPdfBytes))

    // 8. Marquer toutes les prestations comme "Facturé"
    await pool.query(
      `UPDATE prestations SET status = 'Facturé' WHERE id = ANY($1)`,
      [allIds]
    )

    // 9. Retourner le PDF compilé
    const downloadName = `Compilation_Factures_${dateStr}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`)
    res.send(Buffer.from(mergedPdfBytes))
  } catch (err) {
    if (browser) { try { await browser.close() } catch (e) { /* ignore */ } }
    console.error('[export-all-pdf]', err)
    res.status(500).json({ error: err.message || 'Erreur interne' })
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n).toFixed(2).replace('.', ',')
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildInvoiceHtml({ logoDataUri, userName, userAddress, userBce, userAccount, invoiceNumber, invoiceDate, tableBodyHtml, grandTotal }) {
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
      .attention { width: 240px; text-align: left; margin-top: 28px; padding-left: 6px }
      .attention strong { display: block; font-size: 16px; font-weight: 700 }
      .attention div { font-size: 13px }
      .small-muted { color: #666; font-size: 11px }
      .objet { margin-top: 20px; margin-bottom: 4px }
      table.items { width: 100%; border-collapse: collapse; margin-top: 16px }
      table.items th, table.items td { border: 1px solid #ddd; padding: 8px; font-size: 11px }
      table.items th { background: #f7f7f7; text-align: left }
      table.items th:nth-child(2), table.items td:nth-child(2) { width: 80px }
      table.items th:nth-child(3), table.items td:nth-child(3) { width: 90px }
      table.items th:nth-child(4), table.items td:nth-child(4) { width: 110px }
      table.items tfoot td { padding: 8px; border: 1px solid #ddd; background: #fff }
      tr.analytic-header td { background: #eef2ff; font-size: 11px; padding: 5px 8px; border-bottom: 1px solid #c7d2fe }
      tr.subtotal td { background: #f9fafb; font-style: italic; font-size: 11px }
      .footer { clear: both; margin-top: 36px; font-size: 11px; color: #666 }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="left-brand">
        <div class="logo-wrap">
          <img src="${logoDataUri}" alt="logo" />
        </div>
        <div class="provider">
          <div class="name">${escHtml(userName)}</div>
          <div class="meta">${escHtml(userAddress)}</div>
          <div class="meta">${escHtml(userBce)}</div>
          <div class="meta">${escHtml(userAccount)}</div>
        </div>
      </div>
      <div class="right-column">
        <div class="right-meta">
          <div class="invoice-title">FACTURE</div>
          <div class="invoice-ref">Facture No : ${invoiceNumber}</div>
          <div class="invoice-ref">Date : ${invoiceDate}</div>
        </div>
        <div class="attention">
          <strong>A L'attention de :</strong>
          <div>Croix-Rouge de Belgique</div>
          <div>Medical Team Bruxelles Capitale</div>
          <div class="small-muted">Rue Rempart des Moines 78, 1000 Bruxelles</div>
        </div>
      </div>
    </div>

    <div class="objet">
      <strong>Objet :</strong> Prestations médicales — ${invoiceDate}
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Désignation</th>
          <th>Nb d'heures</th>
          <th>Prix/h</th>
          <th>Montant HT</th>
        </tr>
      </thead>
      <tbody>
        ${tableBodyHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right; background:#fff">TVA</td>
          <td style="background:#fff">Non applicable</td>
        </tr>
        <tr>
          <td colspan="3" style="text-align:right; font-weight:700; background:#fff">TOTAL</td>
          <td style="font-weight:700; background:#fff">${fmt(grandTotal)}€</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <div>Prière de régler ce montant par virement bancaire sur le compte suivant : ${escHtml(userAccount || '-')}</div>
      <div style="margin-top:8px">En renseignant votre numéro de facture : <strong>${invoiceNumber}</strong> en communication.</div>
    </div>
  </body>
</html>`
}
