import { getPool } from '../../../../services/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { documentId, status, reason } = req.body;

  if (!documentId || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['approved', 'rejected', 'encoded'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const pool = getPool();

    const updateResult = await pool.query(
      `UPDATE documents
       SET validation_status = $1, validated_at = NOW(), rejection_reason = $2
       WHERE id = $3
       RETURNING *`,
      [status, status === 'rejected' ? reason || null : null, documentId]
    );

    const rows = updateResult.rows || [];
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = rows[0];
    const message = status === 'approved' ? 'valid\u00e9' : (status === 'rejected' ? 'rejet\u00e9' : 'encod\u00e9');
    return res.status(200).json({
      success: true,
      message: `Document ${message} avec succ\u00e8s`,
      document: doc
    });
  } catch (error) {
    console.error('Error validating document:', error);
    return res.status(500).json({ 
      error: 'Failed to validate document',
      details: error.message 
    });
  }
}
