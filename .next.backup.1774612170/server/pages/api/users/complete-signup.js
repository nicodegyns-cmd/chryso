"use strict";(()=>{var e={};e.id=2743,e.ids=[2743],e.modules={8432:e=>{e.exports=require("bcryptjs")},145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},6113:e=>{e.exports=require("crypto")},2399:(e,t,s)=>{s.r(t),s.d(t,{config:()=>d,default:()=>o,routeModule:()=>u});var i=s(1802),r=s(7153),n=s(6249),a=s(7572);let o=(0,n.l)(a,"default"),d=(0,n.l)(a,"config"),u=new i.PagesAPIRouteModule({definition:{kind:r.x.PAGES_API,page:"/api/users/complete-signup",pathname:"/api/users/complete-signup",bundlePath:"",filename:""},userland:a})},7572:(e,t,s)=>{let{query:i}=s(6541);s(6113);let r=s(8432);e.exports=async function(e,t){if("POST"!==e.method)return t.status(405).json({error:"Method not allowed"});try{let{token:s,email:n,first_name:a,last_name:o,password:d,telephone:u,address:p,fonction:l,company:_}=e.body;if(!s||!n||!a||!o||!d)return t.status(400).json({error:"Missing required fields"});let c=await i(`SELECT id FROM users 
       WHERE invitation_token = $1 AND invitation_expires_at > NOW() AND onboarding_status = $2`,[s,"pending_signup"]);if(0===c.rows.length)return t.status(404).json({error:"Invalid or expired token"});let g=c.rows[0].id,m=await r.hash(d,10);await i(`UPDATE users 
       SET password_hash = $1, 
           first_name = $2, 
           last_name = $3, 
           telephone = $4, 
           address = $5, 
           fonction = $6, 
           company = $7,
           onboarding_status = $8,
           invitation_token = NULL,
           invitation_sent_at = NULL,
           invitation_expires_at = NULL
       WHERE id = $9`,[m,a,o,u,p,l,_,"pending_validation",g]),t.status(200).json({success:!0,message:"User data saved. Awaiting admin validation."})}catch(e){return console.error("Complete signup error:",e),t.status(500).json({error:"Failed to complete signup"})}}}};var t=require("../../../webpack-api-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),s=t.X(0,[4222,6541],()=>__webpack_exec__(2399));module.exports=s})();