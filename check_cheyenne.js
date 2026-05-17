const {getPool}=require('./services/db');
const p=getPool();
p.query("SELECT id,email,first_name,last_name,is_active,onboarding_status FROM users WHERE email ILIKE '%chey%' OR first_name ILIKE '%cheyenne%' OR last_name ILIKE '%declercq%'").then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)});
