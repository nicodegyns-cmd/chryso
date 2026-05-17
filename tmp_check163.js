require('dotenv').config();
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT p.id,p.user_id,p.status,p.activity_id,p.analytic_id,p.remuneration_infi,p.remuneration_med,p.garde_hours,p.created_at::text,u.email,u.first_name,u.last_name,u.role,a.title,a.analytic_id as act_analytic_id FROM prestations p LEFT JOIN users u ON p.user_id=u.id LEFT JOIN activities a ON p.activity_id=a.id WHERE p.id=163').then(r=>{console.log(JSON.stringify(r.rows,null,2));p.end()}).catch(e=>{console.error(e.message);p.end()});
