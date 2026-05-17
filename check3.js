const {getPool}=require('./services/db');
const p=getPool();
p.query("SELECT id,email,first_name,last_name,is_active,onboarding_status FROM users WHERE id=330").then(r=>{console.log('user by id:',JSON.stringify(r.rows));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)});
