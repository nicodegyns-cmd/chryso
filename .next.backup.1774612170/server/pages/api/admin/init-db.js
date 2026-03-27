"use strict";(()=>{var e={};e.id=6520,e.ids=[6520],e.modules={2418:e=>{e.exports=require("mysql2/promise")},145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},1883:(e,a,t)=>{t.r(a),t.d(a,{config:()=>l,default:()=>d,routeModule:()=>T});var s={};t.r(s),t.d(s,{default:()=>handler});var i=t(1802),r=t(7153),o=t(6249),n=t(3322);async function handler(e,a){if("POST"!==e.method&&"GET"!==e.method)return a.status(405).json({error:"Method not allowed"});try{return console.log("[INIT-DB-API] Starting database initialization..."),await (0,n.initDatabase)(),a.status(200).json({success:!0,message:"Database tables initialized successfully"})}catch(e){return console.error("[INIT-DB-API] Error:",e.message),a.status(500).json({error:e.message})}}let d=(0,o.l)(s,"default"),l=(0,o.l)(s,"config"),T=new i.PagesAPIRouteModule({definition:{kind:r.x.PAGES_API,page:"/api/admin/init-db",pathname:"/api/admin/init-db",bundlePath:"",filename:""},userland:s})},3322:(e,a,t)=>{let s=t(2418);async function initDatabase(){try{let e=await s.createConnection({host:process.env.DB_HOST||"localhost",user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||"",database:process.env.DB_NAME||"chryso"});console.log("[INIT-DB] Creating documents table if not exists...");let a=`
      CREATE TABLE IF NOT EXISTS documents (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'PDF',
        file_path VARCHAR(1024) NOT NULL,
        file_size BIGINT NOT NULL,
        validation_status VARCHAR(50) DEFAULT 'pending',
        validated_at TIMESTAMP NULL,
        validated_by_id BIGINT NULL,
        rejection_reason VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_validation_status (validation_status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;await e.execute(a),console.log("[INIT-DB] ✅ Documents table ready"),await e.end()}catch(e){console.error("[INIT-DB] Error:",e.message)}}e.exports={initDatabase}}};var a=require("../../../webpack-api-runtime.js");a.C(e);var __webpack_exec__=e=>a(a.s=e),t=a.X(0,[4222],()=>__webpack_exec__(1883));module.exports=t})();