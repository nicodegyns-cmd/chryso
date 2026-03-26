const db = require('../services/db')

async function upsertAnalytics(items){
  for (const it of items){
    try{
      const exists = await db.query('SELECT id FROM analytics WHERE code = ? LIMIT 1', [it.code])
      if (exists && exists.length) {
        console.log('Analytics exists:', it.code)
        continue
      }
      const sql = 'INSERT INTO analytics (name, analytic_type, code, entite, distribution, description, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ? )'
      await db.query(sql, [it.name, it.analytic_type || 'PDF', it.code, it.entite || null, JSON.stringify(it.distribution || []), it.description || null, it.is_active ? 1 : 0, it.created_by || null])
      console.log('Inserted analytic', it.code)
    }catch(e){ console.error('Failed analytic', it.code, e.message) }
  }
}

async function upsertInvoices(items){
  for (const it of items){
    try{
      const exists = await db.query('SELECT id FROM invoices WHERE invoice_number = ? LIMIT 1', [it.invoice_number])
      if (exists && exists.length){ console.log('Invoice exists:', it.invoice_number); continue }
      const sql = `INSERT INTO invoices (invoice_number, user_id, amount, description, status, due_date, paid_date, payment_method, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      await db.query(sql, [it.invoice_number, it.user_id || 1, it.amount || 0, it.description || null, it.status || 'pending', it.due_date || null, it.paid_date || null, it.payment_method || null, it.notes || null, it.created_by || null])
      console.log('Inserted invoice', it.invoice_number)
    }catch(e){ console.error('Failed invoice', it.invoice_number, e.message) }
  }
}

async function run(){
  try{
    console.log('[seed_admin_statistics] starting')
    const analytics = [
      { name: 'Centre de coût A', code: 'CCA-001', entite: 'Opérations', distribution: ['ops@example.com'], description: 'Test analytics A', is_active: true },
      { name: 'Centre de coût B', code: 'CCB-002', entite: 'Finance', distribution: ['finance@example.com'], description: 'Test analytics B', is_active: true },
      { name: 'Projet X', code: 'PRJ-X', entite: 'Projets', distribution: ['pm@example.com'], description: 'Projet X', is_active: true }
    ]

    await upsertAnalytics(analytics)

    const now = new Date()
    function iso(d){ return d ? d.toISOString().slice(0,19).replace('T',' ') : null }

    const invoices = [
      { invoice_number: 'INV-202603-001', user_id: 1, amount: 450.00, description: 'Facture test 1', status: 'pending', due_date: iso(new Date(now.getFullYear(), now.getMonth()+1, 5)), created_by: 1 },
      { invoice_number: 'INV-202602-002', user_id: 2, amount: 1200.00, description: 'Facture test 2', status: 'paid', paid_date: iso(new Date(now.getFullYear(), now.getMonth()-1, 15)), due_date: iso(new Date(now.getFullYear(), now.getMonth()-1, 5)), payment_method: 'bank_transfer', created_by: 1 },
      { invoice_number: 'INV-202601-003', user_id: 3, amount: 300.00, description: 'Facture test 3', status: 'overdue', due_date: iso(new Date(now.getFullYear(), now.getMonth()-2, 10)), created_by: 1 },
      { invoice_number: 'INV-202603-004', user_id: 4, amount: 780.00, description: 'Facture test 4', status: 'pending', due_date: iso(new Date(now.getFullYear(), now.getMonth()+2, 1)), created_by: 1 }
    ]

    await upsertInvoices(invoices)

    // Show summary
    const ai = await db.query('SELECT COUNT(*) as cnt FROM analytics')
    const ii = await db.query('SELECT COUNT(*) as cnt, SUM(amount) as total FROM invoices')
    console.log('Analytics count:', ai && ai[0] && ai[0].cnt)
    console.log('Invoices count:', ii && ii[0] && ii[0].cnt, 'Total amount:', ii && ii[0] && ii[0].total)

    await db.getPool().end()
    console.log('[seed_admin_statistics] done')
    process.exit(0)
  }catch(e){
    console.error('Seed failed', e)
    process.exit(1)
  }
}

if (require.main === module) run()
module.exports = { run }
