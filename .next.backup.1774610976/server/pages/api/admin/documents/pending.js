"use strict";(()=>{var e={};e.id=5850,e.ids=[5850],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},6138:(e,t,a)=>{a.r(t),a.d(t,{config:()=>i,default:()=>o,routeModule:()=>c});var d={};a.r(d),a.d(d,{default:()=>handler});var n=a(1802),s=a(7153),r=a(6249),u=a(6541);async function handler(e,t){if("GET"!==e.method)return t.status(405).json({error:"Method not allowed"});try{let e=(0,u.getPool)(),a=`
      SELECT 
        d.id,
        d.user_id,
        d.name,
        d.type,
        d.file_path,
        d.file_size,
        d.url,
        d.created_at,
        d.validation_status,
        d.rejection_reason,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email,
        u.telephone as phone,
        u.company as company_name,
        u.address,
        u.bce,
        u.account,
        u.fonction
      FROM documents d
      JOIN users u ON d.user_id = u.id
      WHERE d.validation_status = 'pending'
      ORDER BY d.created_at DESC
    `,[d]=await e.query(a);return t.status(200).json({success:!0,documents:d||[],total:d?d.length:0})}catch(e){return console.error("Error fetching pending documents:",e),t.status(500).json({error:"Failed to fetch documents",details:e.message})}}let o=(0,r.l)(d,"default"),i=(0,r.l)(d,"config"),c=new n.PagesAPIRouteModule({definition:{kind:s.x.PAGES_API,page:"/api/admin/documents/pending",pathname:"/api/admin/documents/pending",bundlePath:"",filename:""},userland:d})}};var t=require("../../../../webpack-api-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),a=t.X(0,[4222,6541],()=>__webpack_exec__(6138));module.exports=a})();