const { getPool } = require('../services/db')
const fs = require('fs')
const path = require('path')

async function main(){
  const id = process.argv[2]
  if (!id){
    console.error('Usage: node scripts/generate_invoice.js <prestation_id>')
    process.exit(2)
  }
  const pool = getPool()
  try{
    const [[row]] = await pool.query(
      `SELECT p.*, u.email AS user_email, u.role AS user_role, u.first_name AS user_first_name, u.last_name AS user_last_name, u.telephone AS user_phone, u.address AS user_address, u.bce AS user_bce, u.company AS company_name, u.account AS user_account, an.name AS analytic_name, an.code AS analytic_code
       FROM prestations p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN analytics an ON p.analytic_id = an.id
       WHERE p.id = ? LIMIT 1`, [id]
    )
    if (!row) { console.error('prestation not found'); process.exit(3) }

    // prepare logo
    let logoDataUri = null
    try{
      const candMed = path.join(process.cwd(), 'public', 'assets', 'med team logo.png')
      const candLogo = path.join(process.cwd(), 'public', 'assets', 'logo.png')
      let chosen = null
      if (fs.existsSync(candMed)) chosen = candMed
      else if (fs.existsSync(candLogo)) chosen = candLogo
      if (chosen){
        const buf = fs.readFileSync(chosen)
        const ext = (path.extname(chosen) || '').toLowerCase()
        const mime = ext === '.svg' ? 'image/svg+xml' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : (ext === '.gif' ? 'image/gif' : 'image/png'))
        logoDataUri = `data:${mime};base64,${buf.toString('base64')}`
      }
    }catch(e){ /* ignore */ }

    // invoice ref mapping
    let invoiceRef = (row.analytic_code || row.analytic_name || row.id)
    try{
      const refLower = (invoiceRef||'').toString().toLowerCase().trim()
      const normalized = refLower.replace(/[^a-z0-9\-]/g, '')
      const REF_MAP = { 'sscr-med': '723033/MED', 'sscrmed': '723033/MED' }
      if (REF_MAP[refLower]) invoiceRef = REF_MAP[refLower]
      else if (REF_MAP[normalized]) invoiceRef = REF_MAP[normalized]
    }catch(e){}

    // ensure invoice_number column
    try{ await pool.query("ALTER TABLE prestations ADD COLUMN invoice_number VARCHAR(64) DEFAULT NULL") }catch(e){}

    // generate invoice_number if missing
    if (!row.invoice_number){
      try{
        const year = new Date().getFullYear()
        const like = `${year}-%`
        const [resInv] = await pool.query('SELECT invoice_number FROM prestations WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1', [like])
        let nextNum = 1
        if (resInv && resInv.length > 0 && resInv[0].invoice_number){
          const parts = String(resInv[0].invoice_number).split('-')
          const last = parts[1] || ''
          const n = parseInt(last.replace(/^0+/, '') || '0', 10)
          if (!isNaN(n)) nextNum = n + 1
        }
        const padded = String(nextNum).padStart(5,'0')
        const newInv = `${year}-${padded}`
        await pool.query('UPDATE prestations SET invoice_number = ? WHERE id = ?', [newInv, row.id])
        row.invoice_number = newInv
      }catch(e){ console.warn('invoice_number generation failed', e && e.message) }
    }

    // Use PDF generation date (no time) as invoice date
    const invoiceDate = new Date().toLocaleDateString('fr-FR')
    // month and year of the prestation request (for Objet)
    const prestationMonthYear = row.date ? (() => { const d = new Date(row.date); return `${d.toLocaleString('fr-FR', { month: 'long' })} ${d.getFullYear()}` })() : ''
    // Ensure request_ref exists and persist if missing
    try{ await pool.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS request_ref VARCHAR(64) DEFAULT NULL") }catch(e){}
    if (!row.request_ref){
      try{
        const yearR = new Date().getFullYear()
        const likeR = `REQ-${yearR}-%`
        const [resReq] = await pool.query('SELECT request_ref FROM prestations WHERE request_ref LIKE ? ORDER BY request_ref DESC LIMIT 1', [likeR])
        let nextReq = 1
        if (resReq && resReq.length > 0 && resReq[0].request_ref){
          const parts = String(resReq[0].request_ref).split('-')
          const last = parts[2] || ''
          const n = parseInt(last.replace(/^0+/, '') || '0', 10)
          if (!isNaN(n)) nextReq = n + 1
        }
        const padded = String(nextReq).padStart(5,'0')
        const newReq = `REQ-${yearR}-${padded}`
        await pool.query('UPDATE prestations SET request_ref = ? WHERE id = ?', [newReq, row.id])
        row.request_ref = newReq
      }catch(e){ console.warn('request_ref gen failed', e && e.message) }
    }

    // Prepare prestation date, quantity (hours) and unit price
    const payLower = (row.pay_type || '').toString().toLowerCase()
    const prestationDate = row.date ? new Date(row.date).toLocaleDateString('fr-FR') : invoiceDate
    let quantity = 1
    if (payLower.includes('garde')) quantity = Number(row.garde_hours || 0)
    else if (payLower.includes('permanence') || payLower.includes('sortie') || payLower.includes('astreinte')) quantity = Number(row.hours_actual || 0)
    else quantity = Number(row.hours_actual || row.garde_hours || row.sortie_hours || 1)

    // Determine hourly rates from recent activities if possible
    let rateGardeInfi = null, rateGardeMed = null, rateSortieInfi = null, rateSortieMed = null
    try{
      if (row.analytic_id){
        const [acts] = await pool.query('SELECT pay_type, remuneration_infi, remuneration_med, date FROM activities WHERE analytic_id = ? ORDER BY date DESC', [row.analytic_id])
        if (acts && acts.length > 0){
          for (const a of acts){
            const pt = (a.pay_type||'').toString().toLowerCase()
            if ((rateGardeInfi == null || rateGardeMed == null) && pt.includes('garde')){
              rateGardeInfi = a.remuneration_infi != null ? Number(a.remuneration_infi) : rateGardeInfi
              rateGardeMed = a.remuneration_med != null ? Number(a.remuneration_med) : rateGardeMed
            }
            if ((rateSortieInfi == null || rateSortieMed == null) && (pt.includes('sortie') || pt.includes('permanence') || pt.includes('astreinte'))){
              rateSortieInfi = a.remuneration_infi != null ? Number(a.remuneration_infi) : rateSortieInfi
              rateSortieMed = a.remuneration_med != null ? Number(a.remuneration_med) : rateSortieMed
            }
            if (rateGardeInfi != null && rateGardeMed != null && rateSortieInfi != null && rateSortieMed != null) break
          }
          const a0 = acts[0]
          if (rateGardeInfi == null) rateGardeInfi = a0.remuneration_infi != null ? Number(a0.remuneration_infi) : null
          if (rateGardeMed == null) rateGardeMed = a0.remuneration_med != null ? Number(a0.remuneration_med) : null
          if (rateSortieInfi == null) rateSortieInfi = a0.remuneration_infi != null ? Number(a0.remuneration_infi) : null
          if (rateSortieMed == null) rateSortieMed = a0.remuneration_med != null ? Number(a0.remuneration_med) : null
        }
      }
    }catch(e){ }
    // fallback rates
    const FALLBACK_INF = 20
    const FALLBACK_MED = 30
    if (rateGardeInfi == null) rateGardeInfi = FALLBACK_INF
    if (rateGardeMed == null) rateGardeMed = FALLBACK_MED
    if (rateSortieInfi == null) rateSortieInfi = FALLBACK_INF
    if (rateSortieMed == null) rateSortieMed = FALLBACK_MED

    // resolve user role to pick med/infi rate
    const roleLow = (row.user_role || '').toLowerCase()
    const isMed = (row.user_role && String(row.user_role).toUpperCase().includes('MED')) || roleLow.includes('med')
    const isInfi = (row.user_role && String(row.user_role).toUpperCase().includes('INFI')) || roleLow.includes('infi')
    let unitPrice = 0
    if (payLower.includes('garde')) unitPrice = isMed ? rateGardeMed : rateGardeInfi
    else unitPrice = isMed ? rateSortieMed : rateSortieInfi
    const lineAmount = (Number(unitPrice || 0) * Number(quantity || 0)).toFixed(2)

    // compute totals from rendered lines: main line + overtime line + expenses
    const mainLineAmount = Number(lineAmount || 0)
    const overtimeHours = Number(row.overtime_hours || 0)
    const overtimeAmount = Number(unitPrice || 0) * overtimeHours
    const expenses = Number(row.expense_amount || 0)
    const totalVal = (mainLineAmount + overtimeAmount + expenses).toFixed(2)

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FACTURE — Réf ${row.id}</title>
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
      /* Position the attention block lower and shifted left (mail envelope placement) and increase typography */
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
          <div class="name">${(((row.user_first_name || row.first_name || '') + ' ' + (row.user_last_name || row.last_name || '')).trim()) || (row.company_name || 'Fellah Ilias')}</div>
          <div class="meta">${(row.user_address || row.address || 'Rue de Rotterdam 56 1080 Molenbeek')}</div>
            <div class="meta">${(row.user_bce || row.bce || '')}</div>
        </div>
      </div>

      <div class="right-column">
        <div class="right-meta">
          <div class="invoice-title">FACTURE</div>
          <div class="invoice-ref">Référence : ${invoiceRef}</div>
          <div class="invoice-ref">Facture No : ${row.invoice_number || ''}</div>
          <div class="invoice-ref">Date : ${invoiceDate}</div>
          <div class="invoice-ref">Compte : ${row.account || '-'}</div>
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
        <div>${(row.pay_type || '') + ((row.analytic_name || row.analytic_code) ? ' — ' + (row.analytic_name || row.analytic_code) + (prestationMonthYear ? ' ' + prestationMonthYear : '') : '')}</div>
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
        <tr>
          <td>Prestation — ${prestationDate} — Réf ${row.request_ref || ('#'+row.id)}${row.pay_type ? ' / '+row.pay_type : ''}</td>
          <td>${Number(quantity)}</td>
          <td>${(Number(unitPrice)).toString().replace('.',',')}€</td>
          <td>${(Number(lineAmount)).toString().replace('.',',')}€</td>
        </tr>
        ${ (Number(row.overtime_hours || 0) > 0) ? ('<tr>' +
          '<td>Heures supplémentaires — ' + prestationDate + ' — Réf ' + (row.request_ref || ('#'+row.id)) + '</td>' +
          '<td>' + Number(row.overtime_hours || 0) + '</td>' +
          '<td>' + (Number(unitPrice)).toString().replace('.',',') + '€</td>' +
          '<td>' + (Number(Number(unitPrice || 0) * Number(row.overtime_hours || 0)).toFixed(2)).toString().replace('.',',') + '€</td>' +
        '</tr>') : '' }

        ${ (Number(row.expense_amount || 0) > 0) ? ('<tr>' +
          '<td>Note de frais' + (row.expense_comment ? ' — ' + (row.expense_comment) : '') + '</td>' +
          '<td></td>' +
          '<td></td>' +
          '<td>' + (Number(Number(row.expense_amount || 0)).toFixed(2)).toString().replace('.',',') + '€</td>' +
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
      <div>Prière de régler ce montant par virement bancaire sur le compte suivant : ${row.user_account || row.account || 'BE18063402145665'}</div>
      <div style="margin-top:8px">En renseignant votre numéro de facture : ${row.invoice_number || ''} en communication.</div>
      <div style="margin-top:18px">Commentaires :</div>
      <div style="white-space:pre-wrap">${(row.comments || '-').toString()}</div>
    </div>
  </body>
</html>`

    const puppeteer = require('puppeteer')
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const buffer = await page.pdf({ format: 'A4', printBackground: true })
    const exportsDir = path.join(process.cwd(), 'public', 'exports')
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true })
    const filename = `prestation-${row.id}-${Date.now()}.pdf`
    const filePath = path.join(exportsDir, filename)
    fs.writeFileSync(filePath, buffer)
    const publicUrl = `/exports/${filename}`
    await pool.query('UPDATE prestations SET pdf_url = ? WHERE id = ?', [publicUrl, row.id])
    console.log('Generated', filePath)
    await browser.close()
    process.exit(0)
  }catch(e){
    console.error('Generation failed', e && e.message)
    process.exit(1)
  }
}

main()
