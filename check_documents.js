const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'chryso'
    });
    
    console.log('=== Colonnes de la table documents ===')
    const [cols] = await conn.execute('DESCRIBE documents');
    cols.forEach(c => {
      console.log(`- ${c.Field} (${c.Type}, ${c.Null === 'YES' ? 'nullable' : 'not null'})`)
    });
    
    console.log('\n=== Nombre de documents par status ===')
    const [stats] = await conn.execute(
      'SELECT validation_status, COUNT(*) as count FROM documents GROUP BY validation_status'
    );
    stats.forEach(s => console.log(`- ${s.validation_status}: ${s.count}`));
    
    console.log('\n=== Derniers documents (5) ===')
    const [recent] = await conn.execute(
      'SELECT id, user_id, name, validation_status, file_path FROM documents ORDER BY created_at DESC LIMIT 5'
    );
    console.log(JSON.stringify(recent, null, 2));
    
    await conn.end();
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
