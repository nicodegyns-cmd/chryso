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
        d.file_path,
        d.file_size,
        d.url,
        d.created_at,
        d.validation_status,
        d.rejection_reason,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email,
        u.telephone as phone,
        u.company as company_name,
        u.address,
        u.bce,
        u.account,
        u.fonction
      FROM documents d
      JOIN users u ON d.user_id = u.id
      WHERE d.validation_status = 'pending'
      ORDER BY d.created_at DESC
    `;

    const [rows] = await pool.query(query);
    
    return res.status(200).json({
      success: true,
      documents: rows || [],
      total: rows ? rows.length : 0
    });
  } catch (error) {
    console.error('Error fetching pending documents:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch documents',
      details: error.message 
    });
  }
}
