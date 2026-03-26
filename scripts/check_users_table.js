// scripts/check_users_table.js
const mysql = require('mysql2/promise');

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'chryso'
    });

    const [columns] = await conn.query('DESCRIBE users');
    
    console.log('📋 Structure de la table users:');
    console.log('=====================================');
    columns.forEach(col => {
      console.log(`${col.Field.padEnd(25)} ${col.Type}`);
    });

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}

run();
