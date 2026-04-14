import { getPool } from '../../../../services/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = getPool();
    const { status } = req.query; // 'approved' or 'encoded'
    
    const statuses = status === 'encoded' ? ['encoded'] : ['approved'];

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
        d.validated_at,
        d.validation_status,
        NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))), '') as user_name,
        u.email,
        u.telephone as phone,
        u.company as company_name,
        u.address,
        u.bce,
        u.account,
        u.fonction
      FROM documents d
      JOIN users u ON d.user_id = u.id
      WHERE d.validation_status = ANY($1)
      ORDER BY d.validated_at DESC
    `;

    const q = await pool.query(query, [statuses]);
    const rows = q.rows || [];

    return res.status(200).json({
      success: true,
      documents: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('Error fetching approved documents:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch documents',
      details: error.message 
    });
  }
}
