import { getPool } from '../../services/db'

export default async function handler(req, res){
  try{
    if (req.method === 'GET'){
      const { email } = req.query
      if (!email) {
        return res.status(401).json({ error: 'Email required' })
      }

      if (!process.env.EBRIGADE_TOKEN || !process.env.EBRIGADE_URL) {
        return res.status(200).json({ activities: [] })
      }

      const pool = getPool()
      const q = await pool.query(
        'SELECT id, email, liaison_ebrigade_id FROM users WHERE email = $1 LIMIT 1',
        [email]
      )
      const userRow = (q && q.rows) ? q.rows[0] : null

      if (!userRow) {
        return res.status(404).json({ error: 'User not found' })
      }

      if (!userRow.liaison_ebrigade_id) {
        return res.status(200).json({ activities: [] })
      }

      const today = new Date()
      const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate())
      const oneYearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
      const formatDate = (d) => d.toISOString().split('T')[0]
      const dDebut = formatDate(twoYearsAgo)
      const dFin = formatDate(oneYearLater)

      const base = process.env.EBRIGADE_URL || 'http://127.0.0.1/ebrigade'
      const participationUrl = `${base.replace(/\/$/, '')}/api/export/participation.php`

      const payload = {
        token: process.env.EBRIGADE_TOKEN,
        dDebut,
        dFin
      }

      const fetchResponse = await fetch(participationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const text = await fetchResponse.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (_) {
        return res.status(200).json({ activities: [] })
      }

      let allParts = Array.isArray(data) ? data : data.data || data.participations || data.results || []
      const activities = allParts.filter(p => p.P_ID && p.P_ID.toString() === userRow.liaison_ebrigade_id.toString())

      // MAP eBrigade participations to our format
      const mappedActivities = activities.map(p => ({
        id: `${p.E_CODE}-${p.EH_DATE_DEBUT}-${p.P_ID}`,
        date: p.EH_DATE_DEBUT,
        startTime: p.EH_DEBUT,
        endTime: p.EH_FIN,
        duration: p.EP_DUREE,
        analytic_code: p.E_CODE,
        analytic_name: p.E_LIBELLE || p.activity,
        activity: p.E_LIBELLE || p.activity,
        pay_type: p.TE_LIBELLE || 'Garde',
        isActivity: true,
        status: 'À saisir'
      }))

      return res.status(200).json({ activities: mappedActivities })
    }
  } catch(err){
    console.error('activities API error', err)
    return res.status(500).json({ error: err.message || 'internal' })
  }
}
