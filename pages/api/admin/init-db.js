// pages/api/admin/init-db.js
// Initialize database schema - ADMIN ENDPOINT

import { initDatabase } from '../../../scripts/init-db';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[INIT-DB-API] Starting database initialization...');
    await initDatabase();
    return res.status(200).json({ 
      success: true, 
      message: 'Database tables initialized successfully' 
    });
  } catch (err) {
    console.error('[INIT-DB-API] Error:', err.message);
    return res.status(500).json({ 
      error: err.message 
    });
  }
}
