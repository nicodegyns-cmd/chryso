"use strict";(()=>{var e={};e.id=3753,e.ids=[3753],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},3995:(e,t,r)=>{r.r(t),r.d(t,{config:()=>d,default:()=>i,routeModule:()=>l});var s={};r.r(s),r.d(s,{default:()=>handler});var a=r(1802),n=r(7153),o=r(6249),u=r(6541);async function handler(e,t){if("GET"!==e.method)return t.status(405).json({error:"Method not allowed"});try{let{email:r}=e.query;if(!r)return t.status(400).json({error:"Email is required"});let s=(0,u.getPool)(),[a]=await s.query("SELECT id FROM users WHERE email = ?",[r]);if(!a||0===a.length)return t.status(200).json({documents:[]});let n=a[0].id,[o]=await s.query(`SELECT 
        id,
        name,
        type,
        url,
        file_size,
        created_at,
        validation_status,
        rejection_reason
      FROM documents 
      WHERE user_id = ?
      ORDER BY created_at DESC`,[n]);return t.status(200).json({success:!0,documents:o||[]})}catch(e){return console.error("Get documents error:",e),t.status(500).json({error:"Failed to fetch documents",details:e.message})}}let i=(0,o.l)(s,"default"),d=(0,o.l)(s,"config"),l=new a.PagesAPIRouteModule({definition:{kind:n.x.PAGES_API,page:"/api/documents",pathname:"/api/documents",bundlePath:"",filename:""},userland:s})}};var t=require("../../webpack-api-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),r=t.X(0,[4222,6541],()=>__webpack_exec__(3995));module.exports=r})();