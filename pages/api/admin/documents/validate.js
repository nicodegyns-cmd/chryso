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

    // MySQL doesn't support RETURNING; perform UPDATE then SELECT the row
    const updateQuery = `
      UPDATE documents
      SET validation_status = ?, validated_at = NOW(), rejection_reason = ?
      WHERE id = ?
    `;

    const q_updateResult = await pool.query(updateQuery, [
      status,
      status === 'rejected' ? reason || null : null,
      documentId
    ]);

    // If no rows affected, document not found
    const affected = updateResult && (updateResult.affectedRows || updateResult.affected_rows || 0);
    if (!affected) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Fetch updated row
    const q_rows = await pool.query('SELECT * FROM documents WHERE id = ?', [documentId]);
    const doc = rows && rows[0] ? rows[0] : null;

    const message = status === 'approved' ? 'validé' : (status === 'rejected' ? 'rejeté' : 'encodé');
    return res.status(200).json({
      success: true,
      message: `Document ${message} avec succès`,
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
