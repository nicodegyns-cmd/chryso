import { getPool } from '../../../../services/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = getPool();
    
    const query = `
      SELECT 
        d.id,
        d.user_id,
        d.name,
        d.type,
        d.url,
        d.file_size,
        d.created_at,
        d.validation_status,
        d.rejection_reason,
        u.user_name,
        u.email,
        u.phone,
        u.company_name,
        u.city
      FROM documents d
      JOIN users u ON d.user_id = u.id
      WHERE d.validation_status = 'pending'
      ORDER BY d.created_at DESC
    `;

    const result = await pool.query(query);
    
    return res.status(200).json({
      success: true,
      documents: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching pending documents:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch documents',
      details: error.message 
    });
  }
}
