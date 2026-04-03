const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://fenix:Toulouse94@ay177071-001:35230/fenix?sslmode=disable'
});

async function updatePdfUrls() {
  try {
    // Update all old format URLs to new format
    const result = await pool.query(`
      UPDATE prestations 
      SET pdf_url = '/api/exports/download?file=' || SUBSTRING(pdf_url, 10)
      WHERE pdf_url LIKE '/exports/prestation-%'
      AND pdf_url NOT LIKE '/api/exports/%'
      RETURNING id, pdf_url
    `);
    
    console.log(`✅ Updated ${result.rowCount} PDF URLs`);
    
    // Show the updated URLs
    const verify = await pool.query(`
      SELECT pdf_url FROM prestations WHERE pdf_url IS NOT NULL LIMIT 5
    `);
    
    console.log('\n📋 Sample updated URLs:');
    verify.rows.forEach(row => {
      console.log('  -', row.pdf_url.substring(0, 80) + (row.pdf_url.length > 80 ? '...' : ''));
    });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

updatePdfUrls();
