// pages/api/comptabilite/export-all-pdf.js
// Génère une facture par utilisateur (avec toutes ses prestations groupées par analytique),
// fusionne tout en un seul PDF de compilation, marque les prestations comme "Facturé"

const { getPool } = require('../../../services/db')
const { sendStatusChangeEmail } = require('../../../services/emailService')
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
    const { analytic_id, analyticName, prestation_ids } = req.body || {}

    // 1. Récupérer les prestations "sent_to_billing" — filtrées par IDs spécifiques ou par analytique
    const queryParams = []
    let whereClause = ''
    if (Array.isArray(prestation_ids) && prestation_ids.length > 0) {
      queryParams.push(prestation_ids)
      whereClause = `WHERE p.id = ANY($${queryParams.length})`
    } else {
      let analyticFilter = ''
      if (analytic_id != null) {
        queryParams.push(analytic_id)
        analyticFilter = `AND p.analytic_id = $${queryParams.length}`
      }
      queryParams.push('Envoyé à la facturation')
      const statusParam = `$${queryParams.length}`
      whereClause = `WHERE p.status = ${statusParam} ${analyticFilter}`
    }

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
        an.account_number AS analytic_account_number,
        COALESCE(act_r.remuneration_sortie_infi, 0) AS act_sortie_infi,
        COALESCE(act_r.remuneration_sortie_med,  0) AS act_sortie_med
      FROM prestations p
      LEFT JOIN users u  ON p.user_id   = u.id
      LEFT JOIN analytics an ON p.analytic_id = an.id
      LEFT JOIN LATERAL (
        SELECT remuneration_sortie_infi, remuneration_sortie_med
        FROM activities
        WHERE (p.activity_id IS NOT NULL AND id = p.activity_id)
           OR (p.activity_id IS NULL AND analytic_id = p.analytic_id)
        ORDER BY date DESC NULLS LAST
        LIMIT 1
      ) act_r ON true
      ${whereClause}
      ORDER BY p.user_id, p.analytic_id NULLS LAST, p.date ASC
    `, queryParams)
    const rows = result.rows || []

    if (rows.length === 0) {
      const scope = analyticName ? `pour l'analytique "${analyticName}"` : ''
      return res.status(404).json({ error: `Aucune prestation à facturer (statut "Envoyé à la facturation") ${scope}`.trim() })
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
      // Grouper les prestations par analytique — un PDF par analytique par utilisateur
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

      // Générer UN PDF et UN numéro de facture par analytique
      for (const [, ag] of analyticMap) {
        const invoiceNumber = `${year}-${String(invCounter++).padStart(5, '0')}`

        // Construire le HTML de la table pour cette analytique seulement
        let tableBodyHtml = ''
        let grandTotal = 0

        tableBodyHtml += `
          <tr class="analytic-header">
            <td colspan="4"><strong>📊 ${escHtml(ag.name)}</strong></td>
          </tr>`

        let analyticTotal = 0

        for (const p of ag.items) {
          const isMed = (p.user_role || '').toUpperCase().includes('MED')
          // combinedTotal = montant stocké = (garde_h × taux_garde) + (sortie_h × taux_sortie)
          const combinedTotal = isMed
            ? Number(p.remuneration_med || p.remuneration_infi || 0)
            : Number(p.remuneration_infi || p.remuneration_med || 0)
          // sortieRate = taux horaire de sortie (stocké depuis l'activité, non multiplié par les heures)
          // Fallback sur act_sortie_infi/med si remuneration_sortie non renseigné sur la prestation
          const sortieRate = isMed
            ? (Number(p.remuneration_sortie_med) || Number(p.act_sortie_med) || Number(p.remuneration_sortie_infi) || Number(p.act_sortie_infi) || 0)
            : (Number(p.remuneration_sortie_infi) || Number(p.act_sortie_infi) || Number(p.remuneration_sortie_med) || Number(p.act_sortie_med) || 0)

          const gardeH = Number(p.garde_hours || 0)
          const sortieH = Number(p.sortie_hours || 0)
          const overtimeH = Number(p.overtime_hours || 0)
          const expenses = Number(p.expense_amount || 0)
          const travelAllowance = Number(p.travel_allowance || 0)
          const prestDate = p.date ? new Date(p.date).toLocaleDateString('fr-FR') : invoiceDate
          const codeRef = escHtml(p.ebrigade_activity_code || p.request_ref || ('#' + p.id))
          const payType = escHtml(p.pay_type || '')
          const ebrigadeName = escHtml(p.ebrigade_activity_name || '')
          // Suffixe analytique eBrigade affiché après le code de référence
          const ebrigadeSuffix = ebrigadeName ? ` | ${ebrigadeName}` : ''

          // AVOIR: ligne de correction négative
          if ((p.pay_type || '').toUpperCase() === 'AVOIR' || combinedTotal < 0) {
            const avoirAmt = +combinedTotal.toFixed(2)
            const avoirLabel = escHtml(p.comments || 'Avoir — correction')
            tableBodyHtml += `<tr style="color:#dc2626"><td><strong>AVOIR</strong> — ${avoirLabel}</td><td></td><td></td><td style="color:#dc2626;font-weight:700">${fmt(avoirAmt)}€</td></tr>`
            analyticTotal += avoirAmt
            continue
          }

          // Part sortie du total : taux_sortie × sortie_h
          const sAmtCalc = +(sortieRate * sortieH).toFixed(2)
          // Part garde du total : combinedTotal - sAmtCalc (évite le double comptage)
          const gAmtCalc = +(combinedTotal - sAmtCalc).toFixed(2)
          const gardeUnitPrice = gardeH > 0 ? Number((gAmtCalc / gardeH).toFixed(2)) : 0
          const baseH = Number(p.hours_actual || 0)
          const fallbackUnitPrice = baseH > 0 ? Number((combinedTotal / baseH).toFixed(2)) : 0

          if (gardeH > 0 || sortieH > 0) {
            if (gardeH > 0) {
              tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix} / Garde</td><td>${gardeH}</td><td>${fmt(gardeUnitPrice)}€</td><td>${fmt(gAmtCalc)}€</td></tr>`
              analyticTotal += gAmtCalc
            }
            if (sortieH > 0) {
              tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix} / Sortie</td><td>${sortieH}</td><td>${fmt(sortieRate)}€</td><td>${fmt(sAmtCalc)}€</td></tr>`
              analyticTotal += sAmtCalc
            }
            if (overtimeH > 0) {
              const oAmt = +(gardeUnitPrice * overtimeH).toFixed(2)
              tableBodyHtml += `<tr><td>Heures supplémentaires — ${prestDate} — ${codeRef}${ebrigadeSuffix}</td><td>${overtimeH}</td><td>${fmt(gardeUnitPrice)}€</td><td>${fmt(oAmt)}€</td></tr>`
              analyticTotal += oAmt
            }
          } else {
            const lineAmt = +combinedTotal.toFixed(2)
            if (baseH > 0) {
              tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix}${payType ? ' / ' + payType : ''}</td><td>${baseH}</td><td>${fmt(fallbackUnitPrice)}€</td><td>${fmt(lineAmt)}€</td></tr>`
            } else {
              tableBodyHtml += `<tr><td>Prestation — ${prestDate} — ${codeRef}${ebrigadeSuffix}${payType ? ' / ' + payType : ''}</td><td>—</td><td>—</td><td>${fmt(lineAmt)}€</td></tr>`
            }
            analyticTotal += lineAmt
            if (overtimeH > 0) {
              const oAmt = +(fallbackUnitPrice * overtimeH).toFixed(2)
              tableBodyHtml += `<tr><td>Heures supplémentaires — ${prestDate} — ${codeRef}${ebrigadeSuffix}</td><td>${overtimeH}</td><td>${fmt(fallbackUnitPrice)}€</td><td>${fmt(oAmt)}€</td></tr>`
              analyticTotal += oAmt
            }
          }

          if (expenses > 0) {
            const expComment = escHtml(p.expense_comment || '')
            const isTravelZone = expComment && (expComment.startsWith('Forfait d\u00e9placement') || expComment.startsWith('Frais de d\u00e9placement'))
            let expLabel
            if (isTravelZone) {
              const zonePart = expComment.includes(' - ') ? expComment.split(' - ').slice(1).join(' - ') : ''
              expLabel = `Forfait d\u00e9placement${zonePart ? ' \u2014 ' + zonePart : ''}`
            } else {
              expLabel = `Note de frais${expComment ? ' \u2014 ' + expComment : ''}`
            }
            tableBodyHtml += `<tr><td>${expLabel}</td><td></td><td></td><td>${fmt(expenses)}\u20ac</td></tr>`
            analyticTotal += expenses
          }
          if (travelAllowance > 0) {
            const zoneLabel = p.travel_zone ? ` \u2014 ${escHtml(p.travel_zone)}` : ''
            tableBodyHtml += `<tr><td>Forfait d\u00e9placement${zoneLabel}</td><td></td><td></td><td>${fmt(travelAllowance)}\u20ac</td></tr>`
            analyticTotal += travelAllowance
          }
        }

        grandTotal += analyticTotal
        tableBodyHtml += `
          <tr class="subtotal">
            <td colspan="3" style="text-align:right; font-style:italic">Sous-total ${escHtml(ag.name)}</td>
            <td><strong>${fmt(analyticTotal)}€</strong></td>
          </tr>`

        // HTML complet pour cet utilisateur + cette analytique
        const firstItem = ag.items[0]
        const prestDates = ag.items.map(p => p.date).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))
        const dateMin = prestDates.length ? new Date(prestDates[0]).toLocaleDateString('fr-FR') : invoiceDate
        const dateMax = prestDates.length ? new Date(prestDates[prestDates.length - 1]).toLocaleDateString('fr-FR') : invoiceDate
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
          analyticRef: [firstItem.analytic_name, firstItem.analytic_identifier, firstItem.analytic_code, firstItem.analytic_entite].filter(Boolean).join('-'),
          analyticAccount: ag.account,
          dateMin,
          dateMax,
        })

        // Rendu Puppeteer
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'networkidle0' })
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
        await page.close()

        // Sauvegarder le PDF par analytique
        const safeName = userName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
        const userFilename = `facture-${invoiceNumber}-${safeName}-${Date.now()}.pdf`
        const userFilePath = path.join(exportsDir, userFilename)
        fs.writeFileSync(userFilePath, pdfBuffer)
        const userPdfUrl = `/api/exports/download?file=${encodeURIComponent(userFilename)}`

        // Fusionner dans le PDF global
        const userDoc = await PDFDocument.load(pdfBuffer)
        const pages = await mergedPdf.copyPages(userDoc, userDoc.getPageIndices())
        pages.forEach(p => mergedPdf.addPage(p))

        // Mettre à jour en base : invoice_number + pdf_url pour cette analytique seulement
        await pool.query(
          `UPDATE prestations SET invoice_number = $1, pdf_url = $2 WHERE id = ANY($3)`,
          [invoiceNumber, userPdfUrl, ag.items.map(p => p.id)]
        )
      }
    }

    await browser.close()
    browser = null

    // 7. Sauvegarder la compilation globale
    const mergedPdfBytes = await mergedPdf.save()
    const dateStr = new Date().toISOString().split('T')[0]
    const analyticSlug = (analyticName || '').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    const compilationFilename = analyticSlug
      ? `Compilation_Factures_${analyticSlug}_${dateStr}-${Date.now()}.pdf`
      : `Compilation_Factures_${dateStr}-${Date.now()}.pdf`
    fs.writeFileSync(path.join(exportsDir, compilationFilename), Buffer.from(mergedPdfBytes))

    // 8. Marquer toutes les prestations comme "Facturé"
    await pool.query(
      `UPDATE prestations SET status = 'Facturé', updated_at = NOW() WHERE id = ANY($1)`,
      [allIds]
    )

    // 9. Envoyer un email à chaque utilisateur
    for (const [uid, userPrestations] of userMap.entries()) {
      const firstRow = userPrestations[0]
      const userEmailAddr = firstRow.user_email
      const firstName = firstRow.user_first_name || ''
      const invoiceNum = firstRow.invoice_number || null
      const prestDate = firstRow.date || firstRow.created_at || null
      const analytic = firstRow.analytic_name || analyticName || null
      if (userEmailAddr) {
        sendStatusChangeEmail({
          userEmail: userEmailAddr,
          firstName,
          status: 'Facturé',
          date: prestDate,
          analyticName: analytic,
          invoiceNumber: invoiceNum
        }).catch(e => console.error('[export-all-pdf] email error for', userEmailAddr, e.message))
      }
    }

    // 10. Retourner le PDF compilé
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
          ${analyticRef ? `<div class="invoice-ref">Référence : ${escHtml(analyticRef)}</div>` : ''}
          ${analyticAccount ? `<div class="invoice-ref">Compte : ${escHtml(analyticAccount)}</div>` : ''}
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
      <strong>Objet :</strong> Prestations période du ${dateMin}${dateMax && dateMax !== dateMin ? ` au ${dateMax}` : ''}
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
