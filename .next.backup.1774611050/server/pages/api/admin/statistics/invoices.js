"use strict";(()=>{var e={};e.id=6706,e.ids=[6706],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},9865:(e,a,i)=>{i.r(a),i.d(a,{config:()=>l,default:()=>d,routeModule:()=>o});var t={};i.r(t),i.d(t,{default:()=>handler});var r=i(1802),s=i(7153),n=i(6249),_=i(6541),u=i.n(_);async function handler(e,a){if("GET"!==e.method)return a.status(405).json({error:"Method not allowed"});try{let{startMonth:i,endMonth:t,role:r,userId:s,analyticId:n}=e.query,_="2000-01-01",d="2099-12-31";if(i&&(_=i+"-01"),t){let[e,a]=t.split("-"),i=12===parseInt(a)?new Date(parseInt(e)+1,0,1):new Date(parseInt(e),parseInt(a),1);d=i.toISOString().split("T")[0]}let l=`
      SELECT 
        p.id,
        p.user_id,
        p.analytic_id,
        p.date,
        p.pay_type,
        p.remuneration_infi,
        p.remuneration_med,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        u.role as user_role,
        a.name as analytic_name,
        a.code as analytic_code
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
      WHERE p.date >= ? AND p.date < ?
    `,o=[_,d];r&&""!==r&&(l+=" AND u.role = ?",o.push(r)),s&&""!==s&&(l+=" AND p.user_id = ?",o.push(parseInt(s))),n&&""!==n&&(l+=" AND p.analytic_id = ?",o.push(parseInt(n))),l+=" ORDER BY p.date DESC";let c=await u().query(l,o),p=`
      SELECT
        i.id,
        i.invoice_number,
        i.user_id,
        i.amount,
        i.status,
        i.due_date,
        i.paid_date,
        i.description,
        i.analytic_id,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        u.role as user_role,
        a.name as analytic_name,
        a.code as analytic_code
      FROM invoices i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN analytics a ON i.analytic_id = a.id
      WHERE i.created_at >= ? AND i.created_at < ?
    `,m=[_,d];r&&""!==r&&(p+=" AND u.role = ?",m.push(r)),s&&""!==s&&(p+=" AND i.user_id = ?",m.push(parseInt(s))),n&&""!==n&&(p+=" AND i.analytic_id = ?",m.push(parseInt(n))),p+=" ORDER BY i.created_at DESC";let y=await u().query(p,m);return a.status(200).json({prestations:Array.isArray(c)?c.map(e=>({id:e.id,user_id:e.user_id,analytic_id:e.analytic_id,date:e.date,pay_type:e.pay_type,remuneration_infi:e.remuneration_infi?parseFloat(e.remuneration_infi):0,remuneration_med:e.remuneration_med?parseFloat(e.remuneration_med):0,user_firstName:e.user_first_name,user_lastName:e.user_last_name,user_email:e.user_email,user_role:e.user_role,analytic_name:e.analytic_name,analytic_code:e.analytic_code})):[],invoices:Array.isArray(y)?y.map(e=>({id:e.id,invoice_number:e.invoice_number,user_id:e.user_id,amount:e.amount,status:e.status,due_date:e.due_date,paid_date:e.paid_date,description:e.description,analytic_id:e.analytic_id,user_first_name:e.user_first_name,user_last_name:e.user_last_name,user_email:e.user_email,user_role:e.user_role,analytic_name:e.analytic_name,analytic_code:e.analytic_code})):[]})}catch(e){return console.error("Statistics query error:",e),a.status(500).json({error:"Failed to fetch statistics"})}}let d=(0,n.l)(t,"default"),l=(0,n.l)(t,"config"),o=new r.PagesAPIRouteModule({definition:{kind:s.x.PAGES_API,page:"/api/admin/statistics/invoices",pathname:"/api/admin/statistics/invoices",bundlePath:"",filename:""},userland:t})}};var a=require("../../../../webpack-api-runtime.js");a.C(e);var __webpack_exec__=e=>a(a.s=e),i=a.X(0,[4222,6541],()=>__webpack_exec__(9865));module.exports=i})();