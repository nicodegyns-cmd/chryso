// scripts/run_017_migration.js
const mysql = require('mysql2/promise');
const fs = require('fs');

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
    const sql = fs.readFileSync('./sql/017_add_prestation_status.sql', 'utf8');
    
    await conn.query(sql);
    console.log('✅ Migration 017 exécutée avec succès');

    // Update existing prestations to sent_to_billing status
    const [result] = await conn.query(
      'UPDATE prestations SET status = ? WHERE status = ? OR status IS NULL',
      ['sent_to_billing', 'pending']
    );

    console.log('✅ Statuts mis à jour:', result.affectedRows, 'prestations');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
