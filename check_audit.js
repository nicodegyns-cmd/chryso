const {getPool}=require('./services/db');
const p=getPool();
p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name").then(r=>{console.log('tables:',r.rows.map(x=>x.table_name).join(', '));return p.query("SELECT * FROM audit_log WHERE (details::text ILIKE '%330%' OR details::text ILIKE '%chey%') ORDER BY created_at DESC LIMIT 10")}).then(r=>{console.log('audit:',JSON.stringify(r.rows,null,2));process.exit(0)}).catch(e=>{console.error('audit error:',e.message);process.exit(0)});
