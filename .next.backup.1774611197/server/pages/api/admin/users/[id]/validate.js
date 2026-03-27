"use strict";(()=>{var e={};e.id=5391,e.ids=[5391],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},5819:(e,r,a)=>{a.r(r),a.d(r,{config:()=>l,default:()=>o,routeModule:()=>d});var t=a(1802),s=a(7153),i=a(6249),n=a(8240);let o=(0,i.l)(n,"default"),l=(0,i.l)(n,"config"),d=new t.PagesAPIRouteModule({definition:{kind:s.x.PAGES_API,page:"/api/admin/users/[id]/validate",pathname:"/api/admin/users/[id]/validate",bundlePath:"",filename:""},userland:n})},8240:(e,r,a)=>{let{query:t}=a(6541);e.exports=async function(e,r){if("POST"!==e.method)return r.status(405).json({error:"Method not allowed"});try{let{id:a}=e.query,{liaison_ebrigade_id:s,role:i,niss:n,bce:o,account:l}=e.body;if(!a||!i)return r.status(400).json({error:"Missing required fields"});let d=await t(`UPDATE users
       SET liaison_ebrigade_id = $1,
           role = $2,
           niss = $3,
           bce = $4,
           account = $5,
           onboarding_status = $6,
           is_active = 1
       WHERE id = $7 AND onboarding_status = $8
       RETURNING id, email, first_name, last_name, role`,[s||null,i,n||null,o||null,l||null,"active",parseInt(a),"pending_validation"]);if(0===d.rows.length)return r.status(404).json({error:"User not found or already validated"});let u=d.rows[0];r.status(200).json({success:!0,user:{id:u.id,email:u.email,first_name:u.first_name,last_name:u.last_name,role:u.role}})}catch(e){return console.error("Validate user error:",e),r.status(500).json({error:"Failed to validate user"})}}}};var r=require("../../../../../webpack-api-runtime.js");r.C(e);var __webpack_exec__=e=>r(r.s=e),a=r.X(0,[4222,6541],()=>__webpack_exec__(5819));module.exports=a})();