"use strict";(()=>{var e={};e.id=8300,e.ids=[8300],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},1170:(e,d,t)=>{t.r(d),t.d(d,{config:()=>n,default:()=>u,routeModule:()=>R});var a={};t.r(a),t.d(a,{default:()=>handler});var r=t(1802),i=t(7153),s=t(6249),E=t(6541);async function handler(e,d){if("GET"!==e.method)return d.status(405).json({error:"Method not allowed"});try{let e=(0,E.getPool)(),t=`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.company,
        u.role,
        -- latest RIB doc id/url/name/status
        (SELECT d.id FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%rib%' OR LOWER(d.name) LIKE '%rib%') ORDER BY d.created_at DESC LIMIT 1) AS rib_id,
        (SELECT d.url FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%rib%' OR LOWER(d.name) LIKE '%rib%') ORDER BY d.created_at DESC LIMIT 1) AS rib_url,
        (SELECT d.validation_status FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%rib%' OR LOWER(d.name) LIKE '%rib%') ORDER BY d.created_at DESC LIMIT 1) AS rib_status,
        -- latest fiche doc
        (SELECT d.id FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%fiche%' OR LOWER(d.name) LIKE '%fiche%') ORDER BY d.created_at DESC LIMIT 1) AS fiche_id,
        (SELECT d.url FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%fiche%' OR LOWER(d.name) LIKE '%fiche%') ORDER BY d.created_at DESC LIMIT 1) AS fiche_url,
        (SELECT d.validation_status FROM documents d WHERE d.user_id = u.id AND (LOWER(d.type) LIKE '%fiche%' OR LOWER(d.name) LIKE '%fiche%') ORDER BY d.created_at DESC LIMIT 1) AS fiche_status
      FROM users u
      ORDER BY u.last_name ASC, u.first_name ASC
      LIMIT 2000
    `,[a]=await e.query(t);return d.status(200).json({success:!0,users:a||[]})}catch(e){return console.error("[api/admin/prestataires] error",e),d.status(500).json({error:e.message})}}let u=(0,s.l)(a,"default"),n=(0,s.l)(a,"config"),R=new r.PagesAPIRouteModule({definition:{kind:i.x.PAGES_API,page:"/api/admin/prestataires",pathname:"/api/admin/prestataires",bundlePath:"",filename:""},userland:a})}};var d=require("../../../webpack-api-runtime.js");d.C(e);var __webpack_exec__=e=>d(d.s=e),t=d.X(0,[4222,6541],()=>__webpack_exec__(1170));module.exports=t})();