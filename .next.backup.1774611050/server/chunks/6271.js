"use strict";exports.id=6271,exports.ids=[6271],exports.modules={6271:(e,o,t)=>{let r=t(5184),s=null;function getTransporter(){if(s)return s;let e=function(){let e=process.env.EMAIL_PROVIDER||"smtp";return"gmail"===e?{service:"gmail",auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_PASSWORD}}:"sendgrid"===e?{host:"smtp.sendgrid.net",port:587,secure:!1,auth:{user:"apikey",pass:process.env.SENDGRID_API_KEY}}:{host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||"587"),secure:"true"===process.env.SMTP_SECURE,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}}();return e.auth?.user&&e.auth?.pass?s=r.createTransport(e):(console.warn("[EmailService] SMTP not configured - emails will be logged only"),null)}async function sendUserCreationEmail(e,o,t){try{let r=getTransporter(),s=process.env.APP_NAME||"F\xe9nix",n=process.env.APP_URL||"https://www.sirona-consult.be",i=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur ${s}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 20px;">
      <h1 style="color: #0066cc; margin: 0; font-size: 28px;">Bienvenue sur ${s}!</h1>
    </div>
    
    <p style="margin-top: 0;">Bonjour ${t||"Utilisateur"},</p>
    
    <p>Un compte a \xe9t\xe9 cr\xe9\xe9 pour vous. Voici vos identifiants de connexion :</p>
    
    <div style="background-color: #f0f7ff; border-left: 4px solid #0066cc; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 8px 0;"><strong>Email :</strong></p>
      <p style="margin: 0 0 16px 0; font-family: monospace; background-color: #ffffff; padding: 10px; border-radius: 4px;">${e}</p>
      
      <p style="margin: 8px 0;"><strong>Mot de passe temporaire :</strong></p>
      <p style="margin: 0; font-family: monospace; background-color: #ffffff; padding: 10px; border-radius: 4px; word-break: break-all;">${o}</p>
    </div>
    
    <h3 style="color: #0066cc; margin-top: 30px;">Proc\xe9dure de connexion :</h3>
    <ol style="padding-left: 20px;">
      <li style="margin: 8px 0;">
        <a href="${n}/login" style="color: #0066cc; text-decoration: none; font-weight: bold;">Connectez-vous</a> 
        avec votre email et le mot de passe temporaire
      </li>
      <li style="margin: 8px 0;">
        Acc\xe9dez \xe0 votre 
        <a href="${n}/profile" style="color: #0066cc; text-decoration: none; font-weight: bold;">profil</a>
      </li>
      <li style="margin: 8px 0;">Cliquez sur "Modifier mon mot de passe"</li>
      <li style="margin: 8px 0;">D\xe9finissez un nouveau mot de passe plus s\xe9curis\xe9</li>
    </ol>
    
    <div style="background-color: #fff3cd; border-left: 4px solid #ff9800; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #333;"><strong>⚠️ Important :</strong> Pour votre s\xe9curit\xe9, veuillez changer ce mot de passe d\xe8s votre premi\xe8re connexion.</p>
    </div>
    
    <p style="color: #666; font-size: 13px; margin-top: 30px;">
      Si vous n'avez pas demand\xe9 la cr\xe9ation de ce compte, veuillez ignorer cet email ou contacter l'administration.
    </p>
    
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
      <p style="margin: 4px 0;">\xa9 ${new Date().getFullYear()} ${s}. Tous droits r\xe9serv\xe9s.</p>
      <p style="margin: 4px 0;">Cet email a \xe9t\xe9 envoy\xe9 automatiquement. Veuillez ne pas y r\xe9pondre.</p>
    </div>
    
  </div>
</body>
</html>
    `.trim(),a=`
Bienvenue sur ${s}!

Bonjour ${t||"Utilisateur"},

Un compte a \xe9t\xe9 cr\xe9\xe9 pour vous avec les identifiants suivants:

Email: ${e}
Mot de passe temporaire: ${o}

Proc\xe9dure:
1. Connectez-vous avec votre email et le mot de passe temporaire
2. Acc\xe9dez \xe0 votre profil
3. Cliquez sur "Modifier mon mot de passe"
4. D\xe9finissez un nouveau mot de passe plus s\xe9curis\xe9

Important: Pour votre s\xe9curit\xe9, veuillez changer ce mot de passe d\xe8s votre premi\xe8re connexion.

Si vous n'avez pas demand\xe9 la cr\xe9ation de ce compte, veuillez ignorer cet email ou contacter l'administration.
    `.trim();if(!r)return console.log("[EmailService] Email would be sent:"),console.log("To:",e),console.log("Subject: Bienvenue sur "+s),console.log("Body:",a),console.log("---"),{sent:!1,error:"SMTP not configured - logged to console only"};let l=process.env.SMTP_FROM||process.env.GMAIL_USER||"no-reply@sirona-consult.be",p=l.split("@")[1]||"sirona-consult.be",c=await r.sendMail({from:{name:s,address:l},to:e,subject:`Bienvenue sur ${s} - Vos identifiants de connexion`,html:i,text:a,replyTo:l,headers:{"X-Mailer":"F\xe9nix/1.0","X-Priority":"3 (Normal)",Importance:"normal","Reply-To":l,"Content-Type":"text/html; charset=UTF-8","MIME-Version":"1.0",Precedence:"bulk","List-ID":`<fenix-notifications.${p}>`,"List-Help":`<mailto:${l}?subject=help>`,"List-Unsubscribe":`<mailto:${l}?subject=unsubscribe>`,"Auto-Submitted":"auto-generated","X-Auto-Response-Suppress":"All"}});return console.log("[EmailService] Email sent:",{email:e,messageId:c.messageId}),{sent:!0,messageId:c.messageId}}catch(e){return console.error("[EmailService] Error sending email:",e.message),{sent:!1,error:e.message}}}async function sendPasswordChangeEmail(e,o){try{let t=getTransporter(),r=process.env.APP_NAME||"F\xe9nix",s=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mot de passe modifi\xe9</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10b981; padding-bottom: 20px;">
      <h1 style="color: #10b981; margin: 0; font-size: 28px;">Mot de passe modifi\xe9 ✓</h1>
    </div>
    
    <p style="margin-top: 0;">Bonjour ${o||"Utilisateur"},</p>
    
    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #047857;"><strong>✓ Votre mot de passe a \xe9t\xe9 modifi\xe9 avec succ\xe8s.</strong></p>
    </div>
    
    <p>Vous pouvez maintenant utiliser votre nouveau mot de passe pour vous connecter \xe0 votre compte.</p>
    
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #92400e;">
        <strong>S\xe9curit\xe9 :</strong> Si vous n'avez pas effectu\xe9 cette modification, veuillez 
        <strong>contacter imm\xe9diatement l'administration</strong> pour s\xe9curiser votre compte.
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
      <p style="margin: 4px 0;">\xa9 ${new Date().getFullYear()} ${r}. Tous droits r\xe9serv\xe9s.</p>
      <p style="margin: 4px 0;">Cet email a \xe9t\xe9 envoy\xe9 automatiquement. Veuillez ne pas y r\xe9pondre.</p>
    </div>
    
  </div>
</body>
</html>
    `;if(!t)return console.log("[EmailService] Password change confirmation would be sent to:",e),{sent:!1,error:"SMTP not configured"};let n=process.env.SMTP_FROM||process.env.GMAIL_USER||"no-reply@sirona-consult.be",i=n.split("@")[1]||"sirona-consult.be",a=await t.sendMail({from:{name:r,address:n},to:e,subject:`${r} - Mot de passe modifi\xe9`,html:s,replyTo:n,headers:{"X-Mailer":"F\xe9nix/1.0","X-Priority":"3 (Normal)",Importance:"normal","Reply-To":n,"Content-Type":"text/html; charset=UTF-8","MIME-Version":"1.0",Precedence:"bulk","List-ID":`<fenix-notifications.${i}>`,"List-Help":`<mailto:${n}?subject=help>`,"List-Unsubscribe":`<mailto:${n}?subject=unsubscribe>`,"Auto-Submitted":"auto-generated","X-Auto-Response-Suppress":"All"}});return console.log("[EmailService] Password change email sent:",{email:e,messageId:a.messageId}),{sent:!0,messageId:a.messageId}}catch(e){return console.error("[EmailService] Error sending password change email:",e.message),{sent:!1,error:e.message}}}async function send(e){try{let o=getTransporter();if(!o)return console.log("[EmailService] Email would be sent:"),console.log("To:",e.to),console.log("Subject:",e.subject),console.log("Text:",e.text),console.log("---"),{sent:!1,error:"SMTP not configured - logged to console only"};let t=e.from||process.env.SMTP_FROM||process.env.GMAIL_USER||"no-reply@sirona-consult.be",r=process.env.APP_NAME||"F\xe9nix",s=await o.sendMail({from:{name:r,address:t},to:e.to,subject:e.subject,html:e.html||e.text,text:e.text,replyTo:t,headers:{"X-Mailer":"F\xe9nix/1.0","X-Priority":"3 (Normal)",Importance:"normal","Reply-To":t,"Content-Type":"text/html; charset=UTF-8","MIME-Version":"1.0",Precedence:"bulk","Auto-Submitted":"auto-generated"}});return console.log("[EmailService] Email sent:",{to:e.to,messageId:s.messageId}),{sent:!0,messageId:s.messageId}}catch(e){return console.error("[EmailService] Error sending email:",e.message),{sent:!1,error:e.message}}}e.exports={send,sendUserCreationEmail,sendPasswordChangeEmail}}};