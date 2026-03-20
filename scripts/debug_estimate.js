(async ()=>{
  try{
    const email = 'testuser@gmail.com'
    const base = 'http://localhost:3000'
    const fetch = global.fetch || (await import('node-fetch')).default
    const res = await fetch(base+`/api/prestations?email=${encodeURIComponent(email)}`)
    const ps = await res.json()
    const p = (ps.prestations||[])[0]
    console.log('sample prestation:', {id:p.id,invoice_number:p.invoice_number,request_ref:p.request_ref,garde_hours:p.garde_hours,sortie_hours:p.sortie_hours,overtime_hours:p.overtime_hours,hours_actual:p.hours_actual,pay_type:p.pay_type,analytic_id:p.analytic_id,expense_amount:p.expense_amount})
    const estRes = await fetch(base+'/api/prestations/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({garde_hours:p.garde_hours,sortie_hours:p.sortie_hours,overtime_hours:p.overtime_hours,hours_actual:p.hours_actual,pay_type:p.pay_type,analytic_id:p.analytic_id,user_email:email,expense_amount:p.expense_amount})})
    const est = await estRes.json()
    console.log('estimate result:', est)
  }catch(e){ console.error('debug error', e) ; process.exit(1) }
})()
