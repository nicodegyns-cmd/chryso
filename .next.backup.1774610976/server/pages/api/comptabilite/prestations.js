"use strict";(()=>{var e={};e.id=1915,e.ids=[1915],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},864:(e,a,t)=>{t.r(a),t.d(a,{config:()=>d,default:()=>u,routeModule:()=>_});var i={};t.r(i),t.d(i,{default:()=>handler});var n=t(1802),r=t(7153),s=t(6249),p=t(6541);async function handler(e,a){if("GET"!==e.method)return a.status(405).json({error:"Method not allowed"});try{let t=(0,p.getPool)(),{status:i}=e.query,n=`
      SELECT 
        p.id,
        p.user_id,
        p.analytic_id,
        a.name AS analytic_name,
        a.code AS analytic_code,
        act.pay_type AS activity_type,
        COALESCE(p.remuneration_infi, p.remuneration_med) AS remuneration,
        p.date,
        p.status,
        p.created_at,
        u.first_name,
        u.last_name,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM prestations p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN analytics a ON p.analytic_id = a.id
      LEFT JOIN activities act ON p.activity_id = act.id
      WHERE 1=1
    `,r=[];i&&"all"!==i&&(n+=" AND p.status = ?",r.push(i)),i&&"sent_to_billing"!==i||(n=`
        SELECT 
          p.id,
          p.user_id,
          p.analytic_id,
          a.name AS analytic_name,
          a.code AS analytic_code,
          act.pay_type AS activity_type,
          COALESCE(p.remuneration_infi, p.remuneration_med) AS remuneration,
          p.date,
          p.status,
          p.created_at,
          u.first_name,
          u.last_name,
          u.email,
          CONCAT(u.first_name, ' ', u.last_name) as user_name
        FROM prestations p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN analytics a ON p.analytic_id = a.id
        LEFT JOIN activities act ON p.activity_id = act.id
        WHERE p.status IN ('sent_to_billing', 'invoiced')
      `),n+=" ORDER BY p.date DESC, p.created_at DESC";let s=await t.query(n,r);return a.status(200).json(s)}catch(e){return console.error("[api/comptabilite/prestations]",e),a.status(500).json({error:e.message})}}let u=(0,s.l)(i,"default"),d=(0,s.l)(i,"config"),_=new n.PagesAPIRouteModule({definition:{kind:r.x.PAGES_API,page:"/api/comptabilite/prestations",pathname:"/api/comptabilite/prestations",bundlePath:"",filename:""},userland:i})}};var a=require("../../../webpack-api-runtime.js");a.C(e);var __webpack_exec__=e=>a(a.s=e),t=a.X(0,[4222,6541],()=>__webpack_exec__(864));module.exports=t})();