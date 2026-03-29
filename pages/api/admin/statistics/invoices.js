import db from '../../../../services/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { startMonth, endMonth, role, userId, analyticId } = req.query

    // Build date range
    let startDate = '2000-01-01'
    let endDate = '2099-12-31'

    if (startMonth) {
      startDate = startMonth + '-01'
    }
    if (endMonth) {
      // End of the month
      const [year, month] = endMonth.split('-')
      const nextMonth = parseInt(month) === 12 
        ? new Date(parseInt(year) + 1, 0, 1)
        : new Date(parseInt(year), parseInt(month), 1)
      endDate = nextMonth.toISOString().split('T')[0]
    }

    const getRows = (q) => Array.isArray(q) ? q : (q && q.rows) ? q.rows : []

    // Build prestations query using guarded clauses to avoid dangling ANDs
    const pBase = `
      SELECT
        p.id,
        p.user_id,
        p.analytic_id,
        p.date,
        p.pay_type,
        p.remuneration_infi,
        p.remuneration_med,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        u.role as user_role,
        a.name as analytic_name,
        a.code as analytic_code
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
    `

    const pClauses = ['p.date >= ? AND p.date < ?']
    const params = [startDate, endDate]

    if (role && role !== '') {
      pClauses.push('u.role = ?')
      params.push(role)
    }

    if (userId && userId !== '') {
      pClauses.push('p.user_id = ?')
      params.push(parseInt(userId))
    }

    if (analyticId && analyticId !== '') {
      pClauses.push('p.analytic_id = ?')
      params.push(parseInt(analyticId))
    }

    const pQuery = `${pBase} WHERE ${pClauses.join(' AND ')} ORDER BY p.date DESC`

    console.log('[SQL DEBUG] statistics pQuery', pQuery, params)
    const prestRows = getRows(await db.query(pQuery, params))

    // Also fetch invoices so the frontend can display statistics based on invoices
    const iBase = `
      SELECT
        i.id,
        i.invoice_number,
        i.user_id,
        i.amount,
        i.status,
        i.due_date,
        i.paid_date,
        i.description,
        i.analytic_id,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        u.role as user_role,
        a.name as analytic_name,
        a.code as analytic_code
      FROM invoices i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN analytics a ON i.analytic_id = a.id
    `

    const iClauses = ['i.created_at >= ? AND i.created_at < ?']
    const iParams = [startDate, endDate]
    if (role && role !== '') {
      iClauses.push('u.role = ?')
      iParams.push(role)
    }
    if (userId && userId !== '') {
      iClauses.push('i.user_id = ?')
      iParams.push(parseInt(userId))
    }
    if (analyticId && analyticId !== '') {
      iClauses.push('i.analytic_id = ?')
      iParams.push(parseInt(analyticId))
    }

    const iQuery = `${iBase} WHERE ${iClauses.join(' AND ')} ORDER BY i.created_at DESC`

    console.log('[SQL DEBUG] statistics iQuery', iQuery, iParams)
    const invRows = getRows(await db.query(iQuery, iParams))

    return res.status(200).json({
      prestations: Array.isArray(prestRows) ? prestRows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        analytic_id: row.analytic_id,
        date: row.date,
        pay_type: row.pay_type,
        remuneration_infi: row.remuneration_infi ? parseFloat(row.remuneration_infi) : 0,
        remuneration_med: row.remuneration_med ? parseFloat(row.remuneration_med) : 0,
        user_firstName: row.user_first_name,
        user_lastName: row.user_last_name,
        user_email: row.user_email,
        user_role: row.user_role,
        analytic_name: row.analytic_name,
        analytic_code: row.analytic_code
      })) : [],
      invoices: Array.isArray(invRows) ? invRows.map(row => ({
        id: row.id,
        invoice_number: row.invoice_number,
        user_id: row.user_id,
        amount: row.amount,
        status: row.status,
        due_date: row.due_date,
        paid_date: row.paid_date,
        description: row.description,
        analytic_id: row.analytic_id,
        user_first_name: row.user_first_name,
        user_last_name: row.user_last_name,
        user_email: row.user_email,
        user_role: row.user_role,
        analytic_name: row.analytic_name,
        analytic_code: row.analytic_code
      })) : []
    })
  } catch (error) {
    console.error('Statistics query error:', error)
    return res.status(500).json({ error: 'Failed to fetch statistics' })
  }
}
