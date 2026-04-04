// Minimal handler - single export to ensure no duplicates
const { getPool } = require('../../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  try{
    if (req.method !== 'PATCH'){
      res.setHeader('Allow','PATCH')
      return res.status(405).end('Method Not Allowed')
    }
    const { id } = req.query || {}
    if (!id) return res.status(400).json({ error: 'missing id' })

    // apply allowed updates (Postgres placeholders $n)
    const allowed = ['hours_actual','garde_hours','sortie_hours','overtime_hours','comments','proof_image','remuneration_infi','remuneration_med','status','expense_amount','expense_comment']
    const updates = []
    const params = []
    let paramIndex = 1
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        updates.push(`${k} = $${paramIndex++}`)
        params.push(req.body[k])
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'nothing to update' })

    // append id as last parameter
    params.push(id)
    const idPlaceholder = `$${paramIndex}`
    await pool.query(`UPDATE prestations SET ${updates.join(', ')} WHERE id = ${idPlaceholder}`, params)

    // fetch refreshed row (include user and analytic info for rich invoice template)
    const [[updatedRow]] = await pool.query(
      `SELECT p.*, u.email AS user_email, u.role AS user_role, u.first_name AS user_first_name, u.last_name AS user_last_name, u.telephone AS user_phone, u.address AS user_address, u.bce AS user_bce, u.company AS company_name, u.account AS user_account, an.name AS analytic_name, an.code AS analytic_code, an.entite AS analytic_entite, an.description AS analytic_description, an.analytic_type AS analytic_identifier
       FROM prestations p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN analytics an ON p.analytic_id = an.id
       WHERE p.id = $1 LIMIT 1`, [id]
    )
    if (!updatedRow) return res.status(404).json({ error: 'not found' })

    // FALLBACK: If local analytic not found, try to fetch via eBrigade mappings
    if (!updatedRow.analytic_name && updatedRow.ebrigade_activity_code) {
      try {
        const [[fallbackAnalytic]] = await pool.query(
          `SELECT an.name AS analytic_name, an.code AS analytic_code, an.entite AS analytic_entite, an.analytic_type AS analytic_identifier
           FROM activity_ebrigade_mappings aem
           LEFT JOIN activities act ON aem.activity_id = act.id
           LEFT JOIN analytics an ON act.analytic_id = an.id
           WHERE aem.ebrigade_analytic_name = $1 LIMIT 1`, 
          [updatedRow.ebrigade_activity_code]
        )
        if (fallbackAnalytic && fallbackAnalytic.analytic_name) {
          updatedRow.analytic_name = fallbackAnalytic.analytic_name
          updatedRow.analytic_code = fallbackAnalytic.analytic_code
          updatedRow.analytic_entite = fallbackAnalytic.analytic_entite
          updatedRow.analytic_identifier = fallbackAnalytic.analytic_identifier
        }
      } catch(e) { /* ignore fallback failure */ }
    }

    // If status moved to 'En attente d'envoie', generate PDF if missing
    if (Object.prototype.hasOwnProperty.call(req.body, 'status') && req.body.status === 'En attente d\'envoie'){
      if (!updatedRow.pdf_url){
        try{
          const fs = require('fs')
          const path = require('path')
          const puppeteer = require('puppeteer')

          // Ensure invoice/request columns exist
          try{ await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(64) DEFAULT NULL") }catch(e){}
          try{ await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS request_ref VARCHAR(64) DEFAULT NULL") }catch(e){}
          try{ await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(512) DEFAULT NULL") }catch(e){}

          // create invoice_number if missing
          if (!updatedRow.invoice_number){
            try{
              const year = new Date().getFullYear()
              const like = `${year}-%`
              const [resInv] = await pool.query('SELECT invoice_number FROM prestations WHERE invoice_number LIKE $1 ORDER BY invoice_number DESC LIMIT 1', [like])
              let nextNum = 1
              if (resInv && resInv.length > 0 && resInv[0].invoice_number){
                const parts = String(resInv[0].invoice_number).split('-')
                const last = parts[1] || ''
                const n = parseInt(last.replace(/^0+/, '') || '0', 10)
                if (!isNaN(n)) nextNum = n + 1
              }
              const padded = String(nextNum).padStart(5, '0')
              const newInv = `${year}-${padded}`
              await pool.query('UPDATE prestations SET invoice_number = $1 WHERE id = $2', [newInv, updatedRow.id])
              updatedRow.invoice_number = newInv
            }catch(e){ console.warn('invoice_number generation failed', e && e.message) }
          }

          // create request_ref if missing
          if (!updatedRow.request_ref){
            try{
              const yearR = new Date().getFullYear()
              const likeR = `REQ-${yearR}-%`
              const [resReq] = await pool.query('SELECT request_ref FROM prestations WHERE request_ref LIKE $1 ORDER BY request_ref DESC LIMIT 1', [likeR])
              let nextReq = 1
              if (resReq && resReq.length > 0 && resReq[0].request_ref){
                const partsR = String(resReq[0].request_ref).split('-')
                const lastR = partsR[2] || ''
                const nR = parseInt(lastR.replace(/^0+/, '') || '0', 10)
                if (!isNaN(nR)) nextReq = nR + 1
              }
              const paddedR = String(nextReq).padStart(5, '0')
              const newReq = `REQ-${yearR}-${paddedR}`
              await pool.query('UPDATE prestations SET request_ref = $1 WHERE id = $2', [newReq, updatedRow.id])
              updatedRow.request_ref = newReq
            }catch(e){ console.warn('request_ref generation failed', e && e.message) }
          }

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

          // Use remuneration from prestation record directly (already calculated by user)
          const roleLow = ((updatedRow.user_role || '') + '').toLowerCase()
          const isMed = (updatedRow.user_role && String(updatedRow.user_role).toUpperCase().includes('MED')) || roleLow.includes('med')
          let unitPrice = isMed ? Number(updatedRow.remuneration_med || updatedRow.remuneration_infi || 0) : Number(updatedRow.remuneration_infi || updatedRow.remuneration_med || 0)
          
          // FALLBACK: If no remuneration in prestation, try to fetch from activities via eBrigade mapping
          if (unitPrice === 0 && updatedRow.ebrigade_activity_code) {
            try {
              const [activities] = await pool.query(
                `SELECT remuneration_infi, remuneration_med
                 FROM activity_ebrigade_mappings aem
                 LEFT JOIN activities act ON aem.activity_id = act.id
                 WHERE aem.ebrigade_analytic_name = $1 AND LOWER(act.pay_type) LIKE $2
                 ORDER BY act.date DESC LIMIT 1`,
                [updatedRow.ebrigade_activity_code, `%${updatedRow.pay_type || ''}%`]
              )
              if (activities && activities.length > 0) {
                const fallbackRate = isMed ? (activities[0].remuneration_med || activities[0].remuneration_infi) : (activities[0].remuneration_infi || activities[0].remuneration_med)
                if (fallbackRate) unitPrice = Number(fallbackRate)
              }
            } catch(e) { /* ignore fallback */ }
          }
          
          const lineAmount = (Number(unitPrice || 0) * Number(quantity || 0)).toFixed(2)
          const overtimeHours = Number(updatedRow.overtime_hours || 0)
          const overtimeAmount = Number(unitPrice || 0) * overtimeHours
          const expenses = Number(updatedRow.expense_amount || 0)
          
          // Build rows: support separate garde_hours and sortie_hours if present
          const gardeH = Number(updatedRow.garde_hours || 0)
          const sortieH = Number(updatedRow.sortie_hours || 0)
          let rowsHtml = ''
          let gAmount = 0
          let sAmount = 0
          
          // When we have both garde_hours and sortie_hours, we need separate rates for each
          // Fetch detailed rates if needed
          let gardeRate = null
          let sortieRate = null
          
          if ((gardeH > 0 && sortieH > 0) || (gardeH === 0 && sortieH > 0)) {
            // Need to fetch separate rates from activities
            try {
              const [ratesData] = await pool.query(
                `SELECT remuneration_infi, remuneration_med, remuneration_sortie_infi, remuneration_sortie_med
                 FROM activity_ebrigade_mappings aem
                 LEFT JOIN activities act ON aem.activity_id = act.id
                 WHERE aem.ebrigade_analytic_name = $1 AND LOWER(act.pay_type) LIKE $2
                 ORDER BY act.date DESC LIMIT 1`,
                [updatedRow.ebrigade_activity_code, `%${updatedRow.pay_type || ''}%`]
              )
              if (ratesData && ratesData.length > 0) {
                gardeRate = isMed ? Number(ratesData[0].remuneration_med || 0) : Number(ratesData[0].remuneration_infi || 0)
                sortieRate = isMed ? Number(ratesData[0].remuneration_sortie_med || ratesData[0].remuneration_med || 0) : Number(ratesData[0].remuneration_sortie_infi || ratesData[0].remuneration_infi || 0)
              }
            } catch(e) { /* ignore */ }
          }
          
          if (gardeH > 0){
            // Use separate garde rate if available, otherwise calculate from unitPrice and hours
            let gardeRateToUse = gardeRate
            if (!gardeRateToUse) {
              // If unitPrice represents total amount and we have both types, we can't split reliably
              // Fall back to asking activities or use unitPrice directly for single-type
              gardeRateToUse = (gardeH > 0 && sortieH === 0) ? unitPrice : gardeRate
            }
            if (!gardeRateToUse) gardeRateToUse = unitPrice // Last resort
            gAmount = Number((gardeH * gardeRateToUse).toFixed(2))
            rowsHtml += `<tr><td>Prestation — ${prestationDate} — Réf ${updatedRow.ebrigade_activity_code || updatedRow.request_ref || ('#'+updatedRow.id)} / Garde</td><td>${gardeH}</td><td>${(Number(gardeRateToUse)).toString().replace('.',',')}€</td><td>${(Number(gAmount)).toString().replace('.',',')}€</td></tr>`
          }
          if (sortieH > 0){
            // Use separate sortie rate if available, otherwise calculate from unitPrice
            let sortieRateToUse = sortieRate
            if (!sortieRateToUse) {
              sortieRateToUse = (sortieH > 0 && gardeH === 0) ? unitPrice : sortieRate
            }
            if (!sortieRateToUse) sortieRateToUse = unitPrice // Last resort
            sAmount = Number((sortieH * sortieRateToUse).toFixed(2))
            rowsHtml += `<tr><td>Prestation — ${prestationDate} — Réf ${updatedRow.ebrigade_activity_code || updatedRow.request_ref || ('#'+updatedRow.id)} / Sortie</td><td>${sortieH}</td><td>${(Number(sortieRateToUse)).toString().replace('.',',')}€</td><td>${(Number(sAmount)).toString().replace('.',',')}€</td></tr>`
          }
          
          // fallback single line when no garde/sortie specific hours
          if (!rowsHtml){
            rowsHtml = `<tr><td>Prestation — ${prestationDate} — Réf ${updatedRow.ebrigade_activity_code || updatedRow.request_ref || ('#'+updatedRow.id)}${updatedRow.pay_type ? ' / '+updatedRow.pay_type : ''}</td><td>${Number(quantity)}</td><td>${(Number(unitPrice)).toString().replace('.',',')}€</td><td>${(Number(lineAmount)).toString().replace('.',',')}€</td></tr>`
          }
          
          // overtime line
          let overtimeAmountActual = 0
          if (overtimeHours > 0){
            overtimeAmountActual = Number((unitPrice * overtimeHours).toFixed(2))
            rowsHtml += `<tr><td>Heures supplémentaires (Permanence) — ${prestationDate} — Réf ${updatedRow.request_ref || ('#'+updatedRow.id)}</td><td>${overtimeHours}</td><td>${(Number(unitPrice)).toString().replace('.',',')}€</td><td>${(Number(overtimeAmountActual)).toString().replace('.',',')}€</td></tr>`
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
          <div class="name">${(((updatedRow.user_first_name || updatedRow.first_name || '') + ' ' + (updatedRow.user_last_name || updatedRow.last_name || '')).trim()) || (updatedRow.company_name || 'Fournisseur')}</div>
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
          <div class="invoice-ref">Compte : ${updatedRow.user_account || updatedRow.account || '-'}</div>
        </div>
        <div class="attention">
          <strong>A L'attention de :</strong>
          <div>${updatedRow.analytic_name || 'Croix-Rouge de Belgique'}</div>
          <div>${updatedRow.analytic_code || 'Medical Team Bruxelles Capitale'}</div>
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
          '<td>Note de frais' + (updatedRow.expense_comment ? ' — ' + (updatedRow.expense_comment) : '') + '</td>' +
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
      <div style="margin-top:18px">Commentaires :</div>
      <div style="white-space:pre-wrap">${(updatedRow.comments || '-').toString()}</div>
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

    return res.status(200).json(updatedRow)
  }catch(err){
    console.error('admin prestations [id] error', err)
    return res.status(500).json({ error: 'internal' })
  }
}
