const { getPool } = require('../../../../../services/db')

export default async function handler(req, res){
  const pool = getPool()
  const { id } = req.query
  try{
    if (req.method !== 'POST'){
      res.setHeader('Allow', 'POST')
      return res.status(405).end('Method Not Allowed')
    }

    // Basic existence check
    const [[row]] = await pool.query('SELECT id FROM activities WHERE id = ?', [id])
    if (!row) return res.status(404).json({ error: 'not found' })

    // Simulate queueing a job to generate and send the document
    const jobId = `job_${Date.now()}`
    console.log(`Queued generate/send job ${jobId} for activity ${id}`)

    // Return accepted with job id (processing to be implemented later)
    return res.status(202).json({ status: 'queued', jobId, message: 'Génération & envoi programmés (simulé)' })
  }catch(err){
    console.error('activities/[id]/send API error', err)
    res.status(500).json({ error: 'internal' })
  }
}
