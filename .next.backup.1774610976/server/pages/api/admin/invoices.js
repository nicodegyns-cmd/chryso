"use strict";(()=>{var e={};e.id=4262,e.ids=[4262],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},6302:(e,a,t)=>{t.r(a),t.d(a,{config:()=>l,default:()=>o,routeModule:()=>d});var i={};t.r(i),t.d(i,{default:()=>handler});var r=t(1802),n=t(7153),s=t(6249),u=t(6541);async function handler(e,a){if("GET"!==e.method)return a.status(405).json({error:"Method not allowed"});try{(0,u.getPool)();let{status:t,period:i}=e.query,r=`
      SELECT 
        i.id,
        i.invoice_number,
        i.analytic_id,
        i.user_id,
        i.amount,
        i.status,
        i.created_at,
        i.due_date,
        a.name AS analytic_name,
        u.first_name,
        u.last_name,
        u.email,
        u.company as company_name
      FROM invoices i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN analytics a ON i.analytic_id = a.id
      WHERE 1=1
    `,n=[];if(t&&"tous"!==t&&(r+=" AND i.status = ?",n.push(t)),i&&"all"!==i){let e;let a=new Date;if("month"===i)e=new Date(a.getFullYear(),a.getMonth(),1);else if("quarter"===i){let t=Math.floor(a.getMonth()/3);e=new Date(a.getFullYear(),3*t,1)}else"year"===i&&(e=new Date(a.getFullYear(),0,1));e&&(r+=" AND i.created_at >= ?",n.push(e.toISOString()))}r+=" ORDER BY i.created_at DESC";let s=await (0,u.getPool)().query(r,n);return a.status(200).json(s)}catch(e){return console.error("[api/admin/invoices]",e),a.status(500).json({error:e.message})}}let o=(0,s.l)(i,"default"),l=(0,s.l)(i,"config"),d=new r.PagesAPIRouteModule({definition:{kind:n.x.PAGES_API,page:"/api/admin/invoices",pathname:"/api/admin/invoices",bundlePath:"",filename:""},userland:i})}};var a=require("../../../webpack-api-runtime.js");a.C(e);var __webpack_exec__=e=>a(a.s=e),t=a.X(0,[4222,6541],()=>__webpack_exec__(6302));module.exports=t})();