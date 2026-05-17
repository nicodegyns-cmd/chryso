const {getPool}=require('./services/db');
const p=getPool();
p.query("SELECT id,email,first_name,last_name,is_active,onboarding_status FROM users WHERE email ILIKE '%chey.dc%'").then(r=>{console.log('users:',JSON.stringify(r.rows,null,2));return p.query("SELECT * FROM login_history WHERE email ILIKE '%chey.dc%' ORDER BY logged_in_at DESC LIMIT 3")}).then(r=>{console.log('login_history:',JSON.stringify(r.rows,null,2));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)});
