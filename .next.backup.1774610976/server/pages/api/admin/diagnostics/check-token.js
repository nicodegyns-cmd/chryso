"use strict";(()=>{var e={};e.id=5696,e.ids=[5696],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},4896:(e,t,i)=>{i.r(t),i.d(t,{config:()=>d,default:()=>o,routeModule:()=>u});var n=i(1802),a=i(7153),s=i(6249),r=i(6517);let o=(0,s.l)(r,"default"),d=(0,s.l)(r,"config"),u=new n.PagesAPIRouteModule({definition:{kind:a.x.PAGES_API,page:"/api/admin/diagnostics/check-token",pathname:"/api/admin/diagnostics/check-token",bundlePath:"",filename:""},userland:r})},6517:(e,t,i)=>{let{query:n}=i(6541);e.exports=async function(e,t){try{let{token:i}=e.query;if(!i)return t.status(400).json({error:"Token parameter required"});let a=await n(`SELECT 
        id,
        email, 
        first_name,
        last_name,
        invitation_token,
        invitation_sent_at,
        invitation_expires_at,
        onboarding_status,
        liaison_ebrigade_id
       FROM users 
       WHERE invitation_token = $1`,[i]);if(0===a.rows.length)return t.status(200).json({found:!1,message:"No user found with this token"});let s=a.rows[0],r=new Date(s.invitation_expires_at),o=new Date,d=r<o,u=!d&&"pending_signup"===s.onboarding_status;return t.status(200).json({found:!0,isValid:u,user:{id:s.id,email:s.email,firstName:s.first_name,lastName:s.last_name,ebrigadeId:s.liaison_ebrigade_id,onboardingStatus:s.onboarding_status},token:{token:s.invitation_token?"EXISTS":"NOT SET",sentAt:s.invitation_sent_at,expiresAt:s.invitation_expires_at,isExpired:d,expiresIn:d?"expired":`${Math.floor((r-o)/1e3/60)} minutes`,status:u?"✅ VALID":d?"❌ EXPIRED":`❌ INVALID (status: ${s.onboarding_status})`}})}catch(e){return console.error("Check token error:",e),t.status(500).json({error:"Failed to check token",details:e.message})}}}};var t=require("../../../../webpack-api-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),i=t.X(0,[4222,6541],()=>__webpack_exec__(4896));module.exports=i})();