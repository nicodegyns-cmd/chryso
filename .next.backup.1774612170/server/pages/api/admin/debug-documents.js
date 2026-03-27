"use strict";(()=>{var e={};e.id=8215,e.ids=[8215],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},7728:(e,a,t)=>{t.r(a),t.d(a,{config:()=>o,default:()=>i,routeModule:()=>l});var s={};t.r(s),t.d(s,{default:()=>handler});var d=t(1802),n=t(7153),u=t(6249),r=t(6541);async function handler(e,a){if("GET"!==e.method)return a.status(405).json({error:"Method not allowed"});try{let e=(0,r.getPool)(),[t]=await e.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'documents'
      ORDER BY ordinal_position
    `),[s]=await e.query("SELECT COUNT(*) as total FROM documents"),d=s[0]?.total||0,[n]=await e.query(`
      SELECT 
        d.id, 
        d.user_id, 
        d.name, 
        d.validation_status, 
        d.created_at,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.validation_status = 'pending'
      ORDER BY d.created_at DESC
    `),[u]=await e.query(`
      SELECT 
        d.id, 
        d.user_id, 
        d.name, 
        d.validation_status, 
        d.created_at,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `);return a.status(200).json({success:!0,tableExists:t.length>0,columns:t.map(e=>`${e.column_name} (${e.data_type}, ${"NO"===e.is_nullable?"NOT NULL":"NULL"})`),stats:{totalDocuments:d,pendingDocuments:n.length,userCount:(await e.query("SELECT COUNT(*) as total FROM users"))[0][0]?.total||0},pendingDocuments:n,recentDocuments:u})}catch(e){return console.error("[DEBUG-DOCUMENTS] Error:",e),a.status(500).json({error:"Debug failed",message:e.message,type:e.code})}}let i=(0,u.l)(s,"default"),o=(0,u.l)(s,"config"),l=new d.PagesAPIRouteModule({definition:{kind:n.x.PAGES_API,page:"/api/admin/debug-documents",pathname:"/api/admin/debug-documents",bundlePath:"",filename:""},userland:s})}};var a=require("../../../webpack-api-runtime.js");a.C(e);var __webpack_exec__=e=>a(a.s=e),t=a.X(0,[4222,6541],()=>__webpack_exec__(7728));module.exports=t})();