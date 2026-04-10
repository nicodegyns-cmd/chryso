/**
 * Simple test: Verify that we can connect to the database and execute basic queries
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: 'ay177071-001.eu.clouddb.ovh.net',
  port: 35230,
  user: 'fenix',
  password: 'Toulouse94',
  database: 'fenix',
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  query_timeout: 10000
});

async function test() {
  const client = await pool.connect();
  try {
    console.log('[DB Test] Connected successfully');
    
    // Test: Get analytics
    const res1 = await client.query('SELECT COUNT(*) as count FROM analytics');
    console.log('[DB Test] Analytics count:', res1.rows[0].count);
    
    // Test: Get activities
    const res2 = await client.query('SELECT COUNT(*) as count FROM activities');
    console.log('[DB Test] Activities count:', res2.rows[0].count);
    
    console.log('[DB Test] ✓ Connection works');
    process.exit(0);
  } catch (e) {
    console.error('[DB Test] ✗ Error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

test().catch(err => {
  console.error('[DB Test] Fatal:', err);
  process.exit(1);
});
