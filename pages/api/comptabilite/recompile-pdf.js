// pages/api/comptabilite/recompile-pdf.js
// Recompile les PDFs des prestations "Facturé" en un seul document
// Sans changer les statuts, sans envoyer d'emails
// Mode regenerate=true : régénère depuis les données brutes (un PDF par analytique)

const { getPool } = require('../../../services/db')
const { PDFDocument } = require('pdf-lib')
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

export const config = {
  api: { responseLimit: false },
  maxDuration: 120,
}

// ─── Helpers partagés ────────────────────────────────────────────────────────
function fmt(n) { return Number(n).toFixed(2).replace('.', ',') }
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildTableBody(userPrestations, invoiceDate) {
  let tableBodyHtml = ''
  let grandTotal = 0
  const analyticMap = new Map()
  for (const p of userPrestations) {
    const key = p.analytic_id != null ? String(p.analytic_id) : 'unassigned'
    if (!analyticMap.has(key)) analyticMap.set(key, { name: p.analytic_name || 'Non assigné', items: [] })
    analyticMap.get(key).items.push(p)
  }
  for (const [, ag] of analyticMap) {
    tableBodyHtml += `<tr class="analytic-header"><td colspan="4"><strong>📊 ${escHtml(ag.name)}</strong></td></tr>`
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
      const ebrigadeSuffix = p.ebrigade_activity_name ? ` | ${escHtml(p.ebrigade_activity_name)}` : ''
      const payType = escHtml(p.pay_type || '')
      if ((p.pay_type || '').toUpperCase() === 'AVOIR' || totalAmt < 0) {
        const avoirAmt = +totalAmt.toFixed(2)
        tableBodyHtml += `<tr style="color:#dc2626"><td><strong>AVOIR</strong> — ${escHtml(p.comments || 'Avoir — correction')}</td><td></td><td></td><td style="color:#dc2626;font-weight:700">${fmt(avoirAmt)}€</td></tr>`
        analyticTotal += avoirAmt; continue
      }
      const sumGS = gardeH + sortieH
      const baseHours = sumGS > 0 ? sumGS : Number(p.hours_actual || 0)
      const unitPrice = baseHours > 0 ? Number((totalAmt / baseHours).toFixed(2)) : totalAmt
      if (gardeH > 0 || sortieH > 0) {
        if (gardeH > 0) { const gAmt = +(unitPrice * gardeH).toFixed(2); tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix} / Garde</td><td>${gardeH}</td><td>${fmt(unitPrice)}€</td><td>${fmt(gAmt)}€</td></tr>`; analyticTotal += gAmt }
        if (sortieH > 0) { const sAmt = +(unitPrice * sortieH).toFixed(2); tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix} / Sortie</td><td>${sortieH}</td><td>${fmt(unitPrice)}€</td><td>${fmt(sAmt)}€</td></tr>`; analyticTotal += sAmt }
        if (overtimeH > 0) { const oAmt = +(unitPrice * overtimeH).toFixed(2); tableBodyHtml += `<tr><td>Heures supplémentaires — ${prestDate} — ${codeRef}${ebrigadeSuffix}</td><td>${overtimeH}</td><td>${fmt(unitPrice)}€</td><td>${fmt(oAmt)}€</td></tr>`; analyticTotal += oAmt }
      } else {
        const baseH = Number(p.hours_actual || p.garde_hours || 0)
        const lineAmt = +totalAmt.toFixed(2)
        if (baseH > 0) {
          tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix}${payType ? ' / ' + payType : ''}</td><td>${baseH}</td><td>${fmt(unitPrice)}€</td><td>${fmt(lineAmt)}€</td></tr>`
        } else {
          tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix}${payType ? ' / ' + payType : ''}</td><td>—</td><td>—</td><td>${fmt(lineAmt)}€</td></tr>`
        }
        analyticTotal += lineAmt
        if (overtimeH > 0) { const oAmt = +(unitPrice * overtimeH).toFixed(2); tableBodyHtml += `<tr><td>Heures supplémentaires — ${prestDate} — ${codeRef}${ebrigadeSuffix}</td><td>${overtimeH}</td><td>${fmt(unitPrice)}€</td><td>${fmt(oAmt)}€</td></tr>`; analyticTotal += oAmt }
      }
      if (expenses > 0) {
        const expComment = escHtml(p.expense_comment || '')
        const isTravelZone = expComment && (expComment.startsWith('Forfait déplacement') || expComment.startsWith('Frais de déplacement'))
        const expLabel = isTravelZone ? `Forfait déplacement${expComment.includes(' - ') ? ' — ' + expComment.split(' - ').slice(1).join(' - ') : ''}` : `Note de frais${expComment ? ' — ' + expComment : ''}`
        tableBodyHtml += `<tr><td>${expLabel}</td><td></td><td></td><td>${fmt(expenses)}€</td></tr>`
        analyticTotal += expenses
      }
    }
    grandTotal += analyticTotal
    tableBodyHtml += `<tr class="subtotal"><td colspan="3" style="text-align:right;font-style:italic">Sous-total ${escHtml(ag.name)}</td><td><strong>${fmt(analyticTotal)}€</strong></td></tr>`
  }
  return { tableBodyHtml, grandTotal }
}

function buildInvoiceHtml({ logoDataUri, userName, userAddress, userBce, userAccount, invoiceNumber, invoiceDate, tableBodyHtml, grandTotal, analyticRef, analyticAccount, dateMin, dateMax }) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>FACTURE — ${invoiceNumber}</title><style>
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;font-size:12px;margin:28px}
.header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.left-brand{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.logo-wrap{width:200px;height:200px;display:flex;align-items:center;justify-content:center}
.logo-wrap img{max-width:180px;max-height:180px;width:auto;height:auto;object-fit:contain}
.provider .name{font-weight:800;font-size:18px}.provider .meta{color:#444;margin-top:4px}
.right-meta{text-align:right}.invoice-title{font-size:26px;font-weight:800;letter-spacing:0.6px}
.invoice-ref{color:#444;margin-top:6px}.right-column{display:flex;flex-direction:column;align-items:flex-end}
.attention{width:240px;text-align:left;margin-top:28px;padding-left:6px}
.attention strong{display:block;font-size:16px;font-weight:700}.attention div{font-size:13px}
.small-muted{color:#666;font-size:11px}.objet{margin-top:20px;margin-bottom:4px}
table.items{width:100%;border-collapse:collapse;margin-top:16px}
table.items th,table.items td{border:1px solid #ddd;padding:8px;font-size:11px}
table.items th{background:#f7f7f7;text-align:left}
table.items th:nth-child(2),table.items td:nth-child(2){width:80px}
table.items th:nth-child(3),table.items td:nth-child(3){width:90px}
table.items th:nth-child(4),table.items td:nth-child(4){width:110px}
table.items tfoot td{padding:8px;border:1px solid #ddd;background:#fff}
tr.analytic-header td{background:#eef2ff;font-size:11px;padding:5px 8px;border-bottom:1px solid #c7d2fe}
tr.subtotal td{background:#f9fafb;font-style:italic;font-size:11px}
.footer{clear:both;margin-top:36px;font-size:11px;color:#666}
</style></head><body>
<div class="header"><div class="left-brand"><div class="logo-wrap"><img src="${logoDataUri}" alt="logo"/></div>
<div class="provider"><div class="name">${escHtml(userName)}</div><div class="meta">${escHtml(userAddress)}</div><div class="meta">${escHtml(userBce)}</div><div class="meta">${escHtml(userAccount)}</div></div></div>
<div class="right-column"><div class="right-meta"><div class="invoice-title">FACTURE</div>
<div class="invoice-ref"><strong>${escHtml(invoiceNumber)}</strong> — ${escHtml(invoiceDate)}</div>
${analyticRef ? `<div class="invoice-ref small-muted">${escHtml(analyticRef)}</div>` : ''}
${analyticAccount ? `<div class="invoice-ref small-muted">Compte: ${escHtml(analyticAccount)}</div>` : ''}
</div><div class="attention"><strong>Croix-Rouge de Belgique</strong><div>Medical Team Bruxelles Capitale</div><div>Rue Rempart des Moines 78, 1000 Bruxelles</div></div></div></div>
<p class="objet"><strong>Objet :</strong> Prestations période du ${escHtml(dateMin)} au ${escHtml(dateMax)}</p>
<table class="items"><thead><tr><th>Désignation</th><th>Nb d'heures</th><th>Prix/h</th><th>Montant HT</th></tr></thead>
<tbody>${tableBodyHtml}</tbody>
<tfoot><tr><td colspan="3" style="text-align:right">TVA</td><td>Non applicable</td></tr>
<tr><td colspan="3" style="text-align:right;font-weight:700">TOTAL</td><td style="font-weight:700">${fmt(grandTotal)}€</td></tr></tfoot></table>
<div class="footer"><p>Prière de régler ce montant par virement bancaire sur le compte suivant : ${escHtml(userAccount)}</p>
<p>En renseignant votre numéro de facture : <strong>${escHtml(invoiceNumber)}</strong> en communication.</p></div>
</body></html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let browser = null
  try {
    const pool = getPool()
    const { analytic_id, date_from, date_to, prestation_ids, regenerate } = req.body || {}

    // ── Mode REGENERATE : régénère les PDFs depuis les données brutes ──────────
    if (regenerate) {
      if (!Array.isArray(prestation_ids) || prestation_ids.length === 0) {
        return res.status(400).json({ error: 'prestation_ids requis en mode regenerate' })
      }
      const result = await pool.query(`
        SELECT p.*,
          u.email AS user_email, u.role AS user_role,
          u.first_name AS user_first_name, u.last_name AS user_last_name,
          u.telephone AS user_phone, u.address AS user_address,
          u.bce AS user_bce, u.company AS company_name, u.account AS user_account,
          an.name AS analytic_name, an.code AS analytic_code,
          an.entite AS analytic_entite, an.analytic_type AS analytic_identifier,
          an.account_number AS analytic_account_number
        FROM prestations p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN analytics an ON p.analytic_id = an.id
        WHERE p.id = ANY($1)
        ORDER BY p.user_id, p.analytic_id NULLS LAST, p.date ASC
      `, [prestation_ids])
      const rows = result.rows || []
      if (rows.length === 0) return res.status(404).json({ error: 'Aucune prestation trouvée' })

      // Charger le logo
      let logoDataUri = null
      try {
        const candidates = [path.join(process.cwd(), 'public', 'assets', 'med team logo.png'), path.join(process.cwd(), 'public', 'assets', 'logo.png')]
        for (const c of candidates) {
          if (fs.existsSync(c)) { const buf = fs.readFileSync(c); const ext = path.extname(c).toLowerCase(); const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'; logoDataUri = `data:${mime};base64,${buf.toString('base64')}`; break }
        }
      } catch (e) { /* ignore */ }
      const fallbackLogo = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='76' height='76'><circle cx='38' cy='38' r='36' fill='%23fff' stroke='%23e33' stroke-width='6'/><text x='50%' y='52%' font-size='28' text-anchor='middle' fill='%23e33' font-family='Arial' dy='.3em'>+</text></svg>`

      const invoiceDate = new Date().toLocaleDateString('fr-FR')
      const userMap = new Map()
      for (const row of rows) {
        if (!userMap.has(row.user_id)) userMap.set(row.user_id, [])
        userMap.get(row.user_id).push(row)
      }

      browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
      const mergedPdf = await PDFDocument.create()

      for (const [, userPrestations] of userMap) {
        const first = userPrestations[0]
        const userName = first.company_name || `${first.user_first_name || ''} ${first.user_last_name || ''}`.trim() || first.user_email || 'Fournisseur'
        const invoiceNumber = first.invoice_number || '—'
        const { tableBodyHtml, grandTotal } = buildTableBody(userPrestations, invoiceDate)
        const prestDates = userPrestations.map(p => p.date).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))
        const dateMin = prestDates.length ? new Date(prestDates[0]).toLocaleDateString('fr-FR') : invoiceDate
        const dateMax = prestDates.length ? new Date(prestDates[prestDates.length - 1]).toLocaleDateString('fr-FR') : invoiceDate
        const html = buildInvoiceHtml({ logoDataUri: logoDataUri || fallbackLogo, userName, userAddress: first.user_address || '', userBce: first.user_bce || '', userAccount: first.user_account || '', invoiceNumber, invoiceDate, tableBodyHtml, grandTotal, analyticRef: [first.analytic_name, first.analytic_identifier, first.analytic_code, first.analytic_entite].filter(Boolean).join('-'), analyticAccount: first.analytic_account_number || '', dateMin, dateMax })
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'networkidle0' })
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
        await page.close()
        const userDoc = await PDFDocument.load(pdfBuffer)
        const pages = await mergedPdf.copyPages(userDoc, userDoc.getPageIndices())
        pages.forEach(p => mergedPdf.addPage(p))
      }
      await browser.close(); browser = null

      const mergedPdfBytes = await mergedPdf.save()
      const dateStr = new Date().toISOString().split('T')[0]
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="Recompilation_${dateStr}.pdf"`)
      return res.send(Buffer.from(mergedPdfBytes))
    }

    // ── Mode classique : fusionner les PDFs existants ─────────────────────────
    const queryParams = []
    const conditions = [`p.status = 'Facturé'`, `p.pdf_url IS NOT NULL`, `p.pdf_url != ''`]

    if (Array.isArray(prestation_ids) && prestation_ids.length > 0) {
      queryParams.push(prestation_ids)
      conditions.push(`p.id = ANY($${queryParams.length})`)
    } else {
      if (analytic_id != null) {
        queryParams.push(analytic_id)
        conditions.push(`p.analytic_id = $${queryParams.length}`)
      }
      if (date_from) {
        queryParams.push(date_from)
        conditions.push(`p.date >= $${queryParams.length}`)
      }
      if (date_to) {
        queryParams.push(date_to)
        conditions.push(`p.date <= $${queryParams.length}`)
      }
    }

    const result = await pool.query(`
      SELECT
        p.id, p.invoice_number, p.pdf_url, p.date,
        u.first_name AS user_first_name, u.last_name AS user_last_name, u.company AS company_name,
        an.name AS analytic_name, an.code AS analytic_code
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics an ON p.analytic_id = an.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.invoice_number ASC, p.date ASC
    `, queryParams)

    const rows = result.rows || []
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Aucune facture PDF trouvée avec les filtres sélectionnés' })
    }

    // Dédupliquer par pdf_url : plusieurs prestations peuvent pointer vers le même fichier PDF
    const seenUrls = new Set()
    const uniqueRows = rows.filter(row => {
      if (!row.pdf_url || seenUrls.has(row.pdf_url)) return false
      seenUrls.add(row.pdf_url)
      return true
    })

    // Fusionner les PDFs existants (un seul fichier par pdf_url unique)
    const mergedPdf = await PDFDocument.create()
    const basePath = path.join(process.cwd(), 'public')
    let loadedCount = 0
    const missing = []

    for (const row of uniqueRows) {
      if (!row.pdf_url) continue

      // Résoudre le chemin du fichier
      let filePath = null
      try {
        // Format: /api/exports/download?file=filename.pdf
        if (row.pdf_url.includes('?file=')) {
          const urlParams = new URL(row.pdf_url, 'http://localhost')
          const filename = urlParams.searchParams.get('file')
          if (filename) filePath = path.join(basePath, 'exports', filename)
        } else {
          // Format: /exports/filename.pdf
          filePath = path.join(basePath, row.pdf_url.replace(/^\/+/, ''))
        }
      } catch (e) {
        console.warn(`[recompile-pdf] Could not parse pdf_url for prestation ${row.id}:`, row.pdf_url)
        missing.push(row.id)
        continue
      }

      if (!filePath || !fs.existsSync(filePath)) {
        console.warn(`[recompile-pdf] File not found for prestation ${row.id}: ${filePath}`)
        missing.push(row.id)
        continue
      }

      try {
        const pdfBytes = fs.readFileSync(filePath)
        const doc = await PDFDocument.load(pdfBytes)
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices())
        pages.forEach(p => mergedPdf.addPage(p))
        loadedCount++
      } catch (e) {
        console.error(`[recompile-pdf] Error loading PDF for prestation ${row.id}:`, e.message)
        missing.push(row.id)
      }
    }

    if (loadedCount === 0) {
      return res.status(404).json({
        error: 'Aucun fichier PDF trouvé sur le serveur',
        detail: `${rows.length} prestations trouvées mais aucun fichier PDF accessible`,
        missing
      })
    }

    const mergedPdfBytes = await mergedPdf.save()
    const dateStr = new Date().toISOString().split('T')[0]
    const downloadName = `Compilation_Factures_${dateStr}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`)
    res.setHeader('X-Loaded-Count', loadedCount)
    res.setHeader('X-Missing-Count', missing.length)
    res.send(Buffer.from(mergedPdfBytes))
  } catch (err) {
    console.error('[recompile-pdf]', err)
    res.status(500).json({ error: err.message || 'Erreur interne' })
  }
}
