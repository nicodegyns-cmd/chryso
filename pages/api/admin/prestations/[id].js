// Minimal handler - single export to ensure no duplicates
const { getPool } = require('../../../../services/db')
const { sendStatusChangeEmail } = require('../../../../services/emailService')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method === 'DELETE'){
      const { id } = req.query || {}
      if (!id) return res.status(400).json({ error: 'missing id' })
      await pool.query('DELETE FROM prestations WHERE id = $1', [id])
      return res.status(200).json({ success: true })
    }

    if (req.method !== 'PATCH'){
      res.setHeader('Allow','PATCH, DELETE')
      return res.status(405).end('Method Not Allowed')
    }
    const { id } = req.query || {}
    if (!id) return res.status(400).json({ error: 'missing id' })

    // apply allowed updates (Postgres placeholders $n)
    const allowed = ['hours_actual','garde_hours','sortie_hours','overtime_hours','comments','proof_image','remuneration_infi','remuneration_med','remuneration_sortie_infi','remuneration_sortie_med','status','expense_amount','expense_comment','validated_by_id','validated_by_email']
    const updates = []
    const params = []
    let paramIndex = 1
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        updates.push(`${k} = $${paramIndex++}`)
        params.push(req.body[k])
      }
    }
    // Auto-set validated_at when status becomes "Envoyé à la facturation"
    if (req.body.status === "Envoyé à la facturation" && req.body.validated_by_id) {
      updates.push(`validated_at = NOW()`)
    }
    if (updates.length === 0) return res.status(400).json({ error: 'nothing to update' })

    // append id as last parameter
    params.push(id)
    const idPlaceholder = `$${paramIndex}`
    await pool.query(`UPDATE prestations SET ${updates.join(', ')} WHERE id = ${idPlaceholder}`, params)

    // fetch refreshed row (include user and analytic info for rich invoice template)
    const [[updatedRow]] = await pool.query(
      `SELECT p.*, u.email AS user_email, u.role AS user_role, u.first_name AS user_first_name, u.last_name AS user_last_name, u.telephone AS user_phone, u.address AS user_address, u.bce AS user_bce, u.company AS company_name, u.account AS user_account, an.name AS analytic_name, an.code AS analytic_code, an.entite AS analytic_entite, an.description AS analytic_description, an.analytic_type AS analytic_identifier, an.account_number AS analytic_account_number,
       vuser.first_name AS validated_by_first_name, vuser.last_name AS validated_by_last_name
       FROM prestations p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN analytics an ON p.analytic_id = an.id
       LEFT JOIN users vuser ON p.validated_by_id = vuser.id
       WHERE p.id = $1 LIMIT 1`, [id]
    )
    if (!updatedRow) return res.status(404).json({ error: 'not found' })

    // ALWAYS resolve analytic from eBrigade activity name when available
    // This ensures the correct local analytics is used regardless of what analytic_id is stored
    if (updatedRow.ebrigade_activity_name) {
      try {
        // Extract prefix: "APS - Coupe du Monde" → "APS"
        const extractPrefix = (name) => {
          if (!name) return null
          const match = name.match(/^([^-|]+?)(?:\s*[-|])/)
          return match ? match[1].trim() : name.trim()
        }
        const ebrigadePrefix = extractPrefix(updatedRow.ebrigade_activity_name)
        
        const [mappingRows] = await pool.query(
          `SELECT an.name AS analytic_name, an.code AS analytic_code, an.entite AS analytic_entite, an.analytic_type AS analytic_identifier, an.account_number AS analytic_account_number
           FROM activity_ebrigade_name_mappings nm
           JOIN activities act ON nm.activity_id = act.id
           LEFT JOIN analytics an ON act.analytic_id = an.id
           WHERE nm.ebrigade_analytic_name_pattern = $1
           LIMIT 1`, 
          [ebrigadePrefix]
        )
        const correctAnalytic = mappingRows && mappingRows[0]
        if (correctAnalytic && correctAnalytic.analytic_name) {
          console.log(`[invoice] Overriding analytic from eBrigade prefix "${ebrigadePrefix}": ${updatedRow.analytic_name} → ${correctAnalytic.analytic_name}`)
          updatedRow.analytic_name = correctAnalytic.analytic_name
          updatedRow.analytic_code = correctAnalytic.analytic_code
          updatedRow.analytic_entite = correctAnalytic.analytic_entite
          updatedRow.analytic_identifier = correctAnalytic.analytic_identifier
          if (correctAnalytic.analytic_account_number) updatedRow.analytic_account_number = correctAnalytic.analytic_account_number
        }
      } catch(e) { console.warn('[invoice] eBrigade analytic lookup failed:', e.message) }
    }

    // PDF and invoice_number generation is now handled at export time by /api/comptabilite/export-all-pdf
    // Auto-generation on validation is disabled intentionally
    const targetStatus = req.body.status
    const isInvoiceableStatus = false
    
    if (isInvoiceableStatus){
      // Ensure columns exist
      try{ await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(64) DEFAULT NULL") }catch(e){}
      try{ await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS request_ref VARCHAR(64) DEFAULT NULL") }catch(e){}
      try{ await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(512) DEFAULT NULL") }catch(e){}

      // Generate invoice_number if missing
      if (!updatedRow.invoice_number){
        try{
          console.log(`[admin/prestations/${id}] Generating invoice_number for prestation ${id}...`)
          const year = new Date().getFullYear()
          const like = `${year}-%`
          // Query for the latest invoice_number for this year
          const maxInvRes = await pool.query(
            'SELECT invoice_number FROM prestations WHERE invoice_number LIKE $1 ORDER BY CAST(SUBSTRING(invoice_number, 6) AS INT) DESC LIMIT 1', 
            [like]
          )
          let nextNum = 1
          const invRows = maxInvRes.rows || maxInvRes[0] || []
          if (invRows && invRows.length > 0 && invRows[0].invoice_number){
            const parts = String(invRows[0].invoice_number).split('-')
            const numPart = parseInt(parts[1] || '0', 10)
            if (!isNaN(numPart)) nextNum = numPart + 1
          }
          const padded = String(nextNum).padStart(5, '0')
          const newInv = `${year}-${padded}`
          console.log(`[admin/prestations/${id}] Generated invoice_number: ${newInv}`)
          await pool.query('UPDATE prestations SET invoice_number = $1 WHERE id = $2', [newInv, updatedRow.id])
          updatedRow.invoice_number = newInv
        }catch(e){ 
          console.error(`[admin/prestations/${id}] invoice_number generation failed: ${e && e.message}`)
        }
      }

      // Generate PDF if missing
      if (!updatedRow.pdf_url){
        try{
          const fs = require('fs')
          const path = require('path')
          const puppeteer = require('puppeteer')

          // Build rich invoice HTML (based on scripts/generate_invoice.js template)
          const invoiceDate = new Date().toLocaleDateString('fr-FR')
          const prestationMonthYear = updatedRow.date ? (() => { const d = new Date(updatedRow.date); return `${d.toLocaleString('fr-FR', { month: 'long' })} ${d.getFullYear()}` })() : ''

          // prepare logo (data URI if exists)
          let logoDataUri = null
          try{
            const fsLocal = require('fs')
            const pathLocal = require('path')
            const candMed = pathLocal.join(process.cwd(), 'public', 'assets', 'med team logo.png')
            const candLogo = pathLocal.join(process.cwd(), 'public', 'assets', 'logo.png')
            let chosen = null
            if (fsLocal.existsSync(candMed)) chosen = candMed
            else if (fsLocal.existsSync(candLogo)) chosen = candLogo
            if (chosen){
              const buf = fsLocal.readFileSync(chosen)
              const ext = (pathLocal.extname(chosen) || '').toLowerCase()
              const mime = ext === '.svg' ? 'image/svg+xml' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : (ext === '.gif' ? 'image/gif' : 'image/png'))
              logoDataUri = `data:${mime};base64,${buf.toString('base64')}`
            }
          }catch(e){ /* ignore */ }

          // determine quantity
          const payLower = (updatedRow.pay_type || '').toString().toLowerCase()
          const prestationDate = updatedRow.date ? new Date(updatedRow.date).toLocaleDateString('fr-FR') : invoiceDate
          let quantity = 1
          if (payLower.includes('garde')) quantity = Number(updatedRow.garde_hours || updatedRow.hours_actual || 0)
          else if (payLower.includes('permanence') || payLower.includes('sortie') || payLower.includes('astreinte')) quantity = Number(updatedRow.hours_actual || updatedRow.garde_hours || 0)
          else quantity = Number(updatedRow.hours_actual || updatedRow.garde_hours || 1)

          // Use remuneration from prestation record directly (already calculated total by user)
          const roleLow = ((updatedRow.user_role || '') + '').toLowerCase()
          const isMed = (updatedRow.user_role && String(updatedRow.user_role).toUpperCase().includes('MED')) || roleLow.includes('med')
          // remuneration_infi/med are now TOTAL amounts in DB, not hourly rates
          const totalAmount = isMed ? Number(updatedRow.remuneration_med || updatedRow.remuneration_infi || 0) : Number(updatedRow.remuneration_infi || updatedRow.remuneration_med || 0)
          
          const gardeH = Number(updatedRow.garde_hours || 0)
          const sortieH = Number(updatedRow.sortie_hours || 0)
          
          // Fetch HOURLY RATES from activities (via activity_id FK, ebrigade name mapping or analytic_id)
          let rateGarde = 0, rateSortie = 0
          try {
            let ratesRow = null
            // Try direct FK lookup via activity_id first (most reliable)
            if (updatedRow.activity_id) {
              const ratesQDirect = await pool.query(
                `SELECT remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med
                 FROM activities WHERE id = $1 LIMIT 1`,
                [updatedRow.activity_id]
              )
              const directRows = (ratesQDirect && ratesQDirect.rows) ? ratesQDirect.rows : []
              if (directRows.length > 0) ratesRow = directRows[0]
            }
            // Try via ebrigade NAME mapping (exact prefix match)
            if (!ratesRow && updatedRow.ebrigade_activity_name) {
              const extractPrefix = (name) => {
                if (!name) return null
                const match = name.match(/^([^-|]+?)(?:\s*[-|])/)
                return match ? match[1].trim() : name.trim()
              }
              const ratesQ = await pool.query(
                `SELECT act.remuneration_infi, act.remuneration_med, act.remuneration_sortie_infi, act.remuneration_sortie_med
                 FROM activity_ebrigade_name_mappings nm
                 JOIN activities act ON nm.activity_id = act.id
                 WHERE nm.ebrigade_analytic_name_pattern = $1
                 LIMIT 1`,
                [extractPrefix(updatedRow.ebrigade_activity_name)]
              )
              const ratesRows = (ratesQ && ratesQ.rows) ? ratesQ.rows : (Array.isArray(ratesQ) && Array.isArray(ratesQ[0]) ? ratesQ[0] : [])
              if (ratesRows.length > 0) ratesRow = ratesRows[0]
            }
            // Fallback: try via analytic_id
            if (!ratesRow && updatedRow.analytic_id) {
              const ratesQ2 = await pool.query(
                `SELECT remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med
                 FROM activities WHERE analytic_id = $1 ORDER BY date DESC LIMIT 1`,
                [updatedRow.analytic_id]
              )
              const ratesRows2 = (ratesQ2 && ratesQ2.rows) ? ratesQ2.rows : (Array.isArray(ratesQ2) && Array.isArray(ratesQ2[0]) ? ratesQ2[0] : [])
              if (ratesRows2.length > 0) ratesRow = ratesRows2[0]
            }
            if (ratesRow) {
              rateGarde = isMed ? Number(ratesRow.remuneration_med || ratesRow.remuneration_infi || 0) : Number(ratesRow.remuneration_infi || ratesRow.remuneration_med || 0)
              rateSortie = isMed ? Number(ratesRow.remuneration_sortie_med || ratesRow.remuneration_sortie_infi || rateGarde) : Number(ratesRow.remuneration_sortie_infi || ratesRow.remuneration_sortie_med || rateGarde)
            }
          } catch(e) { console.warn('rate lookup failed:', e && e.message) }
          
          // If no rates found from activities, derive from total / hours
          if (rateGarde === 0 && totalAmount > 0 && (gardeH + sortieH) > 0) {
            // Can't separate garde/sortie without known rates, use average
            rateGarde = Number((totalAmount / (gardeH + sortieH)).toFixed(2))
            rateSortie = rateGarde
          } else if (rateGarde === 0 && totalAmount > 0 && quantity > 0) {
            rateGarde = Number((totalAmount / quantity).toFixed(2))
          }
          
          const unitPrice = rateGarde || totalAmount
          
          const lineAmount = (Number(unitPrice || 0) * Number(quantity || 0)).toFixed(2)
          const overtimeHours = Number(updatedRow.overtime_hours || 0)
          const overtimeAmount = Number(unitPrice || 0) * overtimeHours
          const expenses = Number(updatedRow.expense_amount || 0)
          
          // Build rows: support separate garde_hours and sortie_hours if present
          let rowsHtml = ''
          let gAmount = 0
          let sAmount = 0
          const codeRef = updatedRow.ebrigade_activity_code || updatedRow.request_ref || ('#'+updatedRow.id)
          if (gardeH > 0){
            gAmount = Number((rateGarde * gardeH).toFixed(2))
            rowsHtml += `<tr><td>Prestation — ${prestationDate} — ${codeRef} / Garde</td><td>${gardeH}</td><td>${(Number(rateGarde)).toString().replace('.',',')}€</td><td>${(Number(gAmount)).toString().replace('.',',')}€</td></tr>`
          }
          if (sortieH > 0){
            sAmount = Number((rateSortie * sortieH).toFixed(2))
            rowsHtml += `<tr><td>Prestation — ${prestationDate} — ${codeRef} / Sortie</td><td>${sortieH}</td><td>${(Number(rateSortie)).toString().replace('.',',')}€</td><td>${(Number(sAmount)).toString().replace('.',',')}€</td></tr>`
          }
          // fallback single line when no garde/sortie specific hours
          if (!rowsHtml){
            rowsHtml = `<tr><td>Prestation — ${prestationDate} — ${codeRef}${updatedRow.pay_type ? ' / '+updatedRow.pay_type : ''}</td><td>${Number(quantity)}</td><td>${(Number(unitPrice)).toString().replace('.',',')}€</td><td>${(Number(lineAmount)).toString().replace('.',',')}€</td></tr>`
          }
          // overtime line
          let overtimeAmountActual = 0
          if (overtimeHours > 0){
            overtimeAmountActual = Number((rateGarde * overtimeHours).toFixed(2))
            rowsHtml += `<tr><td>Heures supplémentaires (Permanence) — ${prestationDate} — ${codeRef}</td><td>${overtimeHours}</td><td>${(Number(rateGarde)).toString().replace('.',',')}€</td><td>${(Number(overtimeAmountActual)).toString().replace('.',',')}€</td></tr>`
          }
          
          // Compute total: include garde/sortie amounts when present, otherwise include the fallback line amount
          let baseAmount = 0
          if (gardeH > 0 || sortieH > 0){
            baseAmount = Number(gAmount || 0) + Number(sAmount || 0)
          } else {
            baseAmount = Number((Number(lineAmount) || 0))
          }
          const totalVal = (Number(baseAmount || 0) + Number(overtimeAmountActual || 0) + Number(expenses || 0)).toFixed(2)

          const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FACTURE — Réf ${updatedRow.id}</title>
    <style>
    body{ font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif; color:#111; font-size:12px; margin:28px }
    .header{ display:flex; justify-content:space-between; align-items:flex-start; gap:20px }
    .left-brand{ display:flex; flex-direction:column; gap:8px; align-items:flex-start }
      .logo-wrap{ width:240px; height:240px; display:flex; align-items:center; justify-content:center; background:transparent; border:none }
      .logo-wrap img{ max-width:220px; max-height:220px; width:auto; height:auto; border-radius:0; object-fit:contain }
      .provider{ line-height:1.05 }
      .provider .name{ font-weight:800; font-size:20px }
      .provider .meta{ color:#444; margin-top:6px }
      .addresses .from{ font-size:15px; line-height:1.15; }
      .addresses .from strong{ display:block; font-size:16px; margin-bottom:6px }
      .right-meta{ text-align:right }
      .invoice-title{ font-size:26px; font-weight:800; letter-spacing:0.6px }
      .invoice-ref{ color:#444; margin-top:6px }
      .addresses{ display:flex; gap:28px; margin-top:20px }
      .right-column{ display:flex; flex-direction:column; align-items:flex-end }
      .attention{ width:240px; text-align:left; margin-top:36px; transform:translateX(-90px); padding-left:6px }
      .attention strong{ display:block; font-size:18px; font-weight:700; text-align:left }
      .attention div{ font-size:13px; text-align:left }
      .to { max-width:60% }
      .items-and-totals{ display:block; margin-top:18px }
      table.items{ width:100%; border-collapse:collapse; table-layout:fixed }
      table.items th, table.items td{ border:1px solid #ddd; padding:10px }
      table.items th{ background:#f7f7f7; text-align:left }
      table.items th:nth-child(2){ width:80px }
      table.items th:nth-child(3){ width:100px }
      table.items th:nth-child(4){ width:120px }
      table.items tfoot td{ padding:8px; border:1px solid #ddd; background:#fff }
      .footer{ clear:both; margin-top:40px; font-size:11px; color:#666 }
      .small-muted{ color:#666; font-size:12px }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="left-brand">
        <div class="logo-wrap">
          ${ logoDataUri ? `<img src="${logoDataUri}" alt="logo"/>` : `<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='76' height='76'><circle cx='38' cy='38' r='36' fill='%23fff' stroke='%23e33' stroke-width='6'/><text x='50%' y='52%' font-size='28' text-anchor='middle' fill='%23e33' font-family='Arial' dy='.3em'>+</text></svg>" alt="logo" />` }
        </div>
        <div class="provider">
          <div class="name">${updatedRow.company_name ? updatedRow.company_name : (((updatedRow.user_first_name || updatedRow.first_name || '') + ' ' + (updatedRow.user_last_name || updatedRow.last_name || '')).trim() || 'Fournisseur')}</div>
          <div class="meta">${(updatedRow.user_address || updatedRow.address || '')}</div>
          <div class="meta">${(updatedRow.user_bce || updatedRow.bce || '')}</div>
        </div>
      </div>

      <div class="right-column">
        <div class="right-meta">
          <div class="invoice-title">FACTURE</div>
          <div class="invoice-ref">Référence : ${updatedRow.analytic_name || updatedRow.ebrigade_activity_name || updatedRow.analytic_code || updatedRow.ebrigade_activity_code || ''} ${updatedRow.analytic_identifier ? '- ' + updatedRow.analytic_identifier : ''} ${updatedRow.analytic_code ? '- ' + updatedRow.analytic_code : ''} ${updatedRow.analytic_entite ? '- ' + updatedRow.analytic_entite : ''}</div>
          <div class="invoice-ref">Facture No : ${updatedRow.invoice_number || ''}</div>
          <div class="invoice-ref">Date : ${invoiceDate}</div>
          <div class="invoice-ref">Compte : ${updatedRow.analytic_account_number || updatedRow.user_account || updatedRow.account || '-'}</div>
        </div>
        <div class="attention">
          <strong>A L'attention de :</strong>
          <div>Croix-Rouge de Belgique</div>
          <div>Medical Team Bruxelles Capitale</div>
          <div class="small-muted">Rue Rempart des Moines 78, 1000&nbsp;Bruxelles</div>
        </div>
      </div>
    </div>

    <div class="addresses">
      <div class="to">
        <strong>Objet :</strong>
        <div>${(updatedRow.pay_type || '') + ((updatedRow.analytic_name || updatedRow.analytic_code) ? ' — ' + (updatedRow.analytic_name || updatedRow.analytic_code) + (prestationMonthYear ? ' ' + prestationMonthYear : '') : '')}</div>
      </div>
    </div>

    <div class="items-and-totals">
      <table class="items">
      <thead>
        <tr>
          <th>Désignation</th>
          <th>Nb d'heure</th>
          <th>Prix/h</th>
          <th>Montant HT</th>
        </tr>
      </thead>
      <tbody>
        ${ rowsHtml }
        ${ (Number(updatedRow.expense_amount || 0) > 0) ? ('<tr>' +
          '<td>Note de frais</td>' +
          '<td></td>' +
          '<td></td>' +
          '<td>' + (Number(Number(updatedRow.expense_amount || 0)).toFixed(2)).toString().replace('.',',') + '€</td>' +
        '</tr>') : '' }
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right; background:#fff">TVA</td>
          <td style="background:#fff">Non applicable</td>
        </tr>
        <tr>
          <td colspan="3" style="text-align:right; font-weight:700; background:#fff">Total</td>
          <td style="font-weight:700; background:#fff">${(Number(totalVal)).toString().replace('.',',')}€</td>
        </tr>
      </tfoot>
      </table>
    </div>

    <div class="footer">
      <div>Prière de régler ce montant par virement bancaire sur le compte suivant : ${updatedRow.user_account || updatedRow.account || 'BE18063402145665'}</div>
      <div style="margin-top:8px">En renseignant votre numéro de facture : ${updatedRow.invoice_number || ''} en communication.</div>

    </div>
  </body>
</html>`

          const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] })
          const page = await browser.newPage()
          await page.setContent(html, { waitUntil: 'networkidle0' })
          const buffer = await page.pdf({ format: 'A4', printBackground: true })

          const exportsDir = path.join(process.cwd(), 'public', 'exports')
          if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true })
          const filename = `prestation-${updatedRow.id}-${Date.now()}.pdf`
          const filePath = path.join(exportsDir, filename)
          fs.writeFileSync(filePath, buffer)
          const publicUrl = `/api/exports/download?file=${encodeURIComponent(filename)}`

          console.log('[pdf generation] ✅ SUCCESS for prestation', updatedRow.id, 'saved at', publicUrl)
          await pool.query('UPDATE prestations SET pdf_url = $1 WHERE id = $2', [publicUrl, updatedRow.id])
          updatedRow.pdf_url = publicUrl
          await browser.close()
        }catch(e){
          console.error('pdf generation failed', e && e.message, e && e.stack)
        }
      }
    }

    // Send status change notification email (fire-and-forget)
    if (req.body && req.body.status && updatedRow.user_email) {
      sendStatusChangeEmail({
        userEmail: updatedRow.user_email,
        firstName: updatedRow.user_first_name || updatedRow.first_name || '',
        status: req.body.status,
        date: updatedRow.date,
        analyticName: updatedRow.analytic_name || updatedRow.ebrigade_activity_name || '',
        payType: updatedRow.pay_type || '',
        invoiceNumber: updatedRow.invoice_number || null,
        refusalReason: req.body.refusalReason || null,
      }).catch(e => console.warn('[prestations/[id]] status email failed:', e.message))
    }

    return res.status(200).json(updatedRow)
  }catch(err){
    console.error('admin prestations [id] error', err)
    return res.status(500).json({ error: 'internal' })
  }
}
