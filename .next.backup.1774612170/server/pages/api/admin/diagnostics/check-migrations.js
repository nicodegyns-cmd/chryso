"use strict";(()=>{var e={};e.id=3833,e.ids=[3833],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},9682:(e,n,i)=>{i.r(n),i.d(n,{config:()=>d,default:()=>l,routeModule:()=>m});var t={};i.r(t),i.d(t,{default:()=>handler});var a=i(1802),s=i(7153),r=i(6249);let{query:o}=i(6541);async function handler(e,n){try{let e=await o(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY column_name
    `),i=e.rows.map(e=>e.column_name),t=["invitation_token","invitation_sent_at","invitation_expires_at","onboarding_status","import_batch_id"],a=t.filter(e=>!i.includes(e)),s=t.filter(e=>i.includes(e)),r=await o(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'users'
      ORDER BY indexname
    `),l=r.rows.map(e=>e.indexname),d=["idx_invitation_token","idx_onboarding_status","idx_import_batch"],m=d.filter(e=>!l.includes(e)),u=0===a.length;return n.status(200).json({status:u?"READY":"MIGRATION_NEEDED",timestamp:new Date().toISOString(),database:{totalColumns:i.length,invitationColumns:{required:t.length,present:s.length,missing:a,presentColumns:s},indexes:{required:d.length,present:d.length-m.length,missing:m}},recommendations:[!u&&"Apply migration 011: Add invitation columns",m.length>0&&"Create missing indexes",u&&"✅ Database is ready for invitations"].filter(Boolean)})}catch(e){return console.error("Check migrations error:",e),n.status(500).json({error:"Failed to check migrations",details:e.message})}}let l=(0,r.l)(t,"default"),d=(0,r.l)(t,"config"),m=new a.PagesAPIRouteModule({definition:{kind:s.x.PAGES_API,page:"/api/admin/diagnostics/check-migrations",pathname:"/api/admin/diagnostics/check-migrations",bundlePath:"",filename:""},userland:t})}};var n=require("../../../../webpack-api-runtime.js");n.C(e);var __webpack_exec__=e=>n(n.s=e),i=n.X(0,[4222,6541],()=>__webpack_exec__(9682));module.exports=i})();