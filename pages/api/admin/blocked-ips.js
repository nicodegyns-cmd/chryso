// pages/api/admin/blocked-ips.js
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  const pool = getPool()

  if (req.method === 'GET') {
    try {
      const q = await pool.query('SELECT * FROM blocked_ips ORDER BY created_at DESC')
      const rows = q.rows || q[0] || []
      return res.status(200).json(rows)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const { ip_address, reason, blocked_by } = req.body
    if (!ip_address) return res.status(400).json({ error: 'ip_address required' })
    // Basic IP validation (IPv4 + IPv6)
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6 = /^[0-9a-fA-F:]+$/
    if (!ipv4.test(ip_address) && !ipv6.test(ip_address)) {
      return res.status(400).json({ error: 'Invalid IP address format' })
    }
    try {
      const q = await pool.query(
        'INSERT INTO blocked_ips (ip_address, reason, blocked_by) VALUES ($1, $2, $3) ON CONFLICT (ip_address) DO UPDATE SET reason=$2, blocked_by=$3 RETURNING *',
        [ip_address.trim(), reason || null, blocked_by || 'admin']
      )
      const rows = q.rows || q[0] || []
      return res.status(201).json(rows[0])
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'DELETE') {
    const { ip_address } = req.body
    if (!ip_address) return res.status(400).json({ error: 'ip_address required' })
    try {
      await pool.query('DELETE FROM blocked_ips WHERE ip_address = $1', [ip_address])
      return res.status(200).json({ deleted: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).end()
}
