const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://fenix:Toulouse94@ay177071-001:35230/fenix?sslmode=disable'
});

const sqlDir = path.join(__dirname, 'sql');

(async () => {
  try {
    // Get all SQL files in order
    const files = fs.readdirSync(sqlDir)
      .filter(f => f.endsWith('.sql') && !f.includes('postgres_init'))
      .sort();

    console.log(`Found ${files.length} migration files to apply...\n`);

    for (const file of files) {
      try {
        const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
        console.log(`Applying: ${file}...`);
        await pool.query(sql);
        console.log(`  ✓ Success\n`);
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
          console.log(`  ℹ Skipped (already exists)\n`);
        } else {
          console.error(`  ✗ Error: ${err.message}\n`);
        }
      }
    }

    console.log('All migrations applied!');
    
    // List all tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\nTables created:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (err) {
    console.error('Fatal error:', err.message);
  } finally {
    await pool.end();
  }
})();
