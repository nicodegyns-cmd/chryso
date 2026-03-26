// Force MySQL connection for local dev
process.env.DATABASE_URL = 'mysql://root:@localhost:3306/chryso';

const db = require('../services/db');

(async () => {
  try {
    const pool = db.getPool();
    const result = await pool.query('SELECT id, email, role, first_name, last_name FROM users WHERE email = ?', ['facturation@gmail.com']);
    
    console.log('Query result:', JSON.stringify(result, null, 2));
    
    const rows = result[0];
    if (rows && rows.length > 0) {
      const user = rows[0];
      console.log('\n✅ User found:');
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  Role (raw):', JSON.stringify(user.role));
      console.log('  Role (string):', String(user.role));
      console.log('  Role (lowercase):', String(user.role).toLowerCase());
    } else {
      console.log('\n❌ User not found');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
