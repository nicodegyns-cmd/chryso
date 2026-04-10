const { query } = require('./services/db');

(async () => {
  try {
    console.log('Fetching all pending users...');
    const result = await query("SELECT id, email, first_name, last_name, is_active, onboarding_status, created_at FROM users WHERE is_active = 0 AND onboarding_status IN ('pending_signup', 'pending_validation') ORDER BY created_at DESC");
    const rows = result.rows || result[0] || [];
    console.log('Found ' + rows.length + ' pending users:\n');
    rows.forEach((u, i) => {
      console.log((i+1) + '. ' + u.email + ' - ' + u.first_name + ' ' + u.last_name + ' [' + u.onboarding_status + ']');
    });
    
    console.log('\n=== Searching for adrienmatteodaltilia@hotmail.fr ===');
    const found = rows.find(u => u.email.toLowerCase() === 'adrienmatteodaltilia@hotmail.fr');
    if (found) {
      console.log('✓ FOUND - Status: ' + found.onboarding_status);
      console.log('  ID: ' + found.id);
      console.log('  Active: ' + found.is_active);
    } else {
      console.log('✗ NOT FOUND in pending list');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
