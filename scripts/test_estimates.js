(async()=>{
  try{
    const fetch = globalThis.fetch
    if (!fetch) throw new Error('Global fetch not available in this Node runtime')
    const email = process.argv[2] || 'testuser@gmail.com'
    const base = 'http://localhost:3000'
    console.log('Using email:', email)

    const res = await fetch(`${base}/api/prestations?email=${encodeURIComponent(email)}`)
    if (!res.ok) { console.error('Failed to fetch prestations', res.status); process.exit(1) }
    const data = await res.json()
    const prestations = data.prestations || []
    console.log('Prestations returned:', prestations.length)

    let aggregate = 0
    for (const p of prestations){
      if (!p.invoice_number) continue
      const body = {
        garde_hours: p.garde_hours || 0,
        sortie_hours: p.sortie_hours || 0,
        overtime_hours: p.overtime_hours || 0,
        hours_actual: p.hours_actual || 0,
        pay_type: p.pay_type || '',
        analytic_id: p.analytic_id || null,
        expense_amount: p.expense_amount || 0,
        user_email: email
      }
      try{
        const estRes = await fetch(`${base}/api/prestations/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        if (!estRes.ok){ console.warn('Estimate API returned', estRes.status); continue }
        const est = await estRes.json()
        const et = Number(est.estimated_total || 0)
        console.log('ID', p.id, p.request_ref || p.invoice_number, '->', et.toFixed(2), '€', JSON.stringify({infi:est.estimated_infi, med:est.estimated_med, expense: p.expense_amount||0}))
        aggregate += et
      }catch(err){ console.warn('Estimate error for prestation', p.id, err.message) }
    }
    console.log('Aggregate estimated total for invoices:', aggregate.toFixed(2), 'EUR')
  }catch(err){ console.error('Script error', err && err.message); process.exit(1) }
})()
