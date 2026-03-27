"use strict";(()=>{var e={};e.id=3110,e.ids=[3110],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},5184:e=>{e.exports=require("nodemailer")},9514:(e,t,r)=>{r.r(t),r.d(t,{config:()=>l,default:()=>a,routeModule:()=>u});var i=r(1802),o=r(7153),n=r(6249),s=r(2735);let a=(0,n.l)(s,"default"),l=(0,n.l)(s,"config"),u=new i.PagesAPIRouteModule({definition:{kind:o.x.PAGES_API,page:"/api/admin/users/send-invitations",pathname:"/api/admin/users/send-invitations",bundlePath:"",filename:""},userland:s})},2735:(e,t,r)=>{let i=r(6271);e.exports=async function(e,t){if("POST"!==e.method)return t.status(405).json({error:"Method not allowed"});try{let{users:r}=e.body;if(!Array.isArray(r)||0===r.length)return t.status(400).json({error:"No users to send invitations to"});let o=process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_API_URL||"http://localhost:3000",n=[];for(let e of r)try{let t=`${o}/signup?token=${encodeURIComponent(e.invitation_token)}`,r=`
Bienvenue,

Vous avez \xe9t\xe9 invit\xe9 \xe0 rejoindre notre plateforme. Cliquez sur le lien ci-dessous pour compl\xe9ter votre profil:

${t}

Ce lien est valide pendant 7 jours.

Cordialement,
L'\xe9quipe d'administration
        `;await i.send({to:e.email,subject:"Invitation \xe0 compl\xe9ter votre profil",text:r,html:`<p>Bienvenue,</p>
<p>Vous avez \xe9t\xe9 invit\xe9 \xe0 rejoindre notre plateforme. <a href="${t}">Cliquez ici pour compl\xe9ter votre profil</a></p>
<p>Ce lien est valide pendant 7 jours.</p>
<p>Cordialement,<br>L'\xe9quipe d'administration</p>`}),n.push({email:e.email,success:!0})}catch(t){console.error(`Failed to send email to ${e.email}:`,t),n.push({email:e.email,success:!1,error:t.message})}let s=n.filter(e=>e.success).length;t.status(200).json({summary:{total:n.length,sent:s,failed:n.length-s},results:n})}catch(e){return console.error("Send invitations error:",e),t.status(500).json({error:"Failed to send invitations"})}}}};var t=require("../../../../webpack-api-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),r=t.X(0,[4222,6271],()=>__webpack_exec__(9514));module.exports=r})();