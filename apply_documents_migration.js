const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'chryso'
    });
    
    const sql = fs.readFileSync('./sql/create_documents_table.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const stmt of statements) {
      console.log('Executing:', stmt.substring(0, 50) + '...');
      await conn.execute(stmt);
    }
    
    console.log('\n✅ Documents table created successfully!');
    
    // Verify
    const [cols] = await conn.execute('DESCRIBE documents');
    console.log('\nTable structure:');
    cols.forEach(c => {
      console.log(`  ${c.Field.padEnd(25)} ${c.Type.padEnd(20)} ${c.Null === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    await conn.end();
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
