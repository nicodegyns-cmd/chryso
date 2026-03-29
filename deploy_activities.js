#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const fileContent = `import { getPool } from '../../services/db'

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
      const participationUrl = \`\${base.replace(/\\/$/, '')}/api/export/participation.php\`

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

      let allParticipations = Array.isArray(data) ? data : data.data || data.participations || data.results || []
      
      const userParticipations = allParticipations.filter(p => {
        return p.P_ID && p.P_ID.toString() === userRow.liaison_ebrigade_id.toString()
      })

      const activities = userParticipations.filter(p => {
        const hasHours = p.hours_actual || p.hours_garde || p.hours_permanence || p.hours_total
        const hasRemuneration = p.remuneration_infi || p.remuneration_med || p.amount_total
        return !hasHours && !hasRemuneration
      })

      let localActivities = []
      try {
        const q2 = await pool.query(
          'SELECT id, analytic_id, analytic_name, analytic_code, pay_type, remuneration_infi, remuneration_med FROM activities'
        )
        localActivities = (q2 && q2.rows) ? q2.rows : []
      } catch (err) {
        localActivities = []
      }
      
      const localActivitiesByType = {}
      if (Array.isArray(localActivities)) {
        localActivities.forEach(act => {
          if (act.pay_type) {
            const key = act.pay_type.toLowerCase().trim()
            if (!localActivitiesByType[key]) {
              localActivitiesByType[key] = []
            }
            localActivitiesByType[key].push(act)
          }
        })
      }

      const transformed = activities.map(p => {
        let activityType = ''
        if (p.TE_LIBELLE) {
          activityType = p.TE_LIBELLE.toLowerCase().trim()
        } else if (p.type) {
          activityType = p.type.toLowerCase().trim()
        } else if (p.activity_type) {
          activityType = p.activity_type.toLowerCase().trim()
        }
        
        if (activityType === 'garde') {
          let typeSource = null
          if (p.TE_TYPE_GARDE) {
            typeSource = p.TE_TYPE_GARDE
          } else if (p.TYPE_GARDE) {
            typeSource = p.TYPE_GARDE
          } else if (p.TE_LIB_TYPE_GARDE) {
            typeSource = p.TE_LIB_TYPE_GARDE
          } else if (p.E_LIBELLE) {
            typeSource = p.E_LIBELLE
          }
          
          if (typeSource) {
            const typeLower = String(typeSource).toLowerCase().trim()
            const mainCode = typeLower.split(/[-\\s]/)[0].trim()
            
            if (mainCode && mainCode !== 'garde' && localActivitiesByType[mainCode]) {
              activityType = mainCode
            } else {
              if (typeLower.includes('permanence')) {
                activityType = 'permanence'
              } else if (typeLower.includes('aps')) {
                activityType = 'aps'
              } else if (typeLower.includes('sortie')) {
                activityType = 'sortie'
              } else if (typeLower.includes('formation')) {
                activityType = 'formation'
              } else if (typeLower.includes('réunion')) {
                activityType = 'réunion'
              }
            }
          }
        }
        
        if (!activityType) {
          activityType = 'garde'
        }

        let localActivity = (localActivitiesByType[activityType] || [])[0]
        
        return {
          id: \`\${p.E_CODE}-\${p.EH_DATE_DEBUT}-\${p.P_ID}\`,
          analytic_id: localActivity?.analytic_id || null,
          analytic_name: p.E_LIBELLE || p.name || p.projet || '',
          analytic_code: p.E_CODE || p.code || '',
          pay_type: localActivity?.pay_type || p.TE_LIBELLE || p.type || 'Garde',
          date: p.EH_DATE_DEBUT || p.date || p.date_start || p.start_date,
          startTime: p.EH_DEBUT,
          endTime: p.EH_FIN,
          duration: p.EP_DUREE,
          activity: p.E_LIBELLE || p.name || p.projet || 'Activity',
          remuneration_infi: localActivity?.remuneration_infi ?? p.remuneration_infi ?? p.rate_infi ?? null,
          remuneration_med: localActivity?.remuneration_med ?? p.remuneration_med ?? p.rate_med ?? null,
          isActivity: true,
          status: 'À saisir'
        }
      })

      return res.status(200).json({ activities: transformed })
    }

    res.setHeader('Allow','GET')
    res.status(405).end('Method Not Allowed')
  }catch(err){
    console.error('activities API error', err)
    res.status(200).json({ activities: [], error: err.message })
  }
}
`;

const targetPath = path.join(__dirname, 'pages/api/activities.js');
fs.writeFileSync(targetPath, fileContent, 'utf8');
console.log('✓ activities.js successfully updated');
