// scripts/run_016_migration.js
const mysql = require('mysql2/promise');

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'chryso',
      multipleStatements: true
    });

    console.log('✅ Connecté à la base de données');

    // Read and execute the SQL migration
    const fs = require('fs');
    const sql = fs.readFileSync('./sql/016_create_invoices_table.sql', 'utf8');
    
    await conn.query(sql);
    console.log('✅ Migration 016 exécutée avec succès - Table invoices créée');

    // Verify table was created
    const [tables] = await conn.query("SHOW TABLES LIKE 'invoices'");
    if (tables.length > 0) {
      console.log('✅ Table invoices vérifiée et fonctionnelle');
    }

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
