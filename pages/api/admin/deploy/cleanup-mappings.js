import { getPool } from '../../../../services/db'

export default async function handler(req, res) {
  // Security: Check admin header/token if deployed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const pool = getPool()

  try {
    console.log('[cleanup-mappings] Starting cleanup of activity_ebrigade_mappings...')

    // Get all current mappings
    const [mappings] = await pool.query(`
      SELECT id, activity_id, ebrigade_analytic_name 
      FROM activity_ebrigade_mappings
      ORDER BY id
    `)

    console.log(`[cleanup-mappings] Found ${mappings.length} mappings`)

    let deletedCount = 0
    let keptCount = 0
    const deleted = []
    const kept = []

    // For each mapping, check if it's just a code or a name
    for (const m of mappings) {
      const isCodeOnly = /^\d{4}$/.test(m.ebrigade_analytic_name)

      if (!isCodeOnly) {
        // Extract the code from the name (e.g., "9336" from "9336 — Permanence INFI")
        const codeMatch = m.ebrigade_analytic_name.match(/^(\d{4})/)
        if (codeMatch) {
          const code = codeMatch[1]
          console.log(`[cleanup-mappings] Deleting "${m.ebrigade_analytic_name}" → keeping code ${code}`)
          
          await pool.query('DELETE FROM activity_ebrigade_mappings WHERE id = $1', [m.id])
          
          deleted.push({
            id: m.id,
            activity_id: m.activity_id,
            old_name: m.ebrigade_analytic_name,
            extracted_code: code
          })
          deletedCount++
        }
      } else {
        console.log(`[cleanup-mappings] Keeping code-only: ${m.ebrigade_analytic_name}`)
        kept.push({
          id: m.id,
          activity_id: m.activity_id,
          code: m.ebrigade_analytic_name
        })
        keptCount++
      }
    }

    console.log(`[cleanup-mappings] Cleanup complete: Deleted ${deletedCount}, Kept ${keptCount}`)

    res.status(200).json({
      success: true,
      summary: {
        total: mappings.length,
        deleted: deletedCount,
        kept: keptCount
      },
      deleted,
      kept
    })
  } catch (err) {
    console.error('[cleanup-mappings] Error:', err)
    res.status(500).json({
      error: 'Cleanup failed',
      message: err.message
    })
  }
}
