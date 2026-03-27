"use strict";(()=>{var e={};e.id=955,e.ids=[955],e.modules={145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},8018:e=>{e.exports=require("puppeteer")},7147:e=>{e.exports=require("fs")},1017:e=>{e.exports=require("path")},7665:(e,t,i)=>{i.r(t),i.d(t,{config:()=>l,default:()=>d,routeModule:()=>u});var r={};i.r(r),i.d(r,{default:()=>handler});var a=i(1802),n=i(7153),o=i(6249);let{getPool:s}=i(6541);async function handler(e,t){let r=s();try{if("PATCH"!==e.method)return t.setHeader("Allow","PATCH"),t.status(405).end("Method Not Allowed");let{id:a}=e.query||{};if(!a)return t.status(400).json({error:"missing id"});let n=[],o=[];for(let t of["hours_actual","garde_hours","sortie_hours","overtime_hours","comments","proof_image","remuneration_infi","remuneration_med","status","expense_amount","expense_comment"])Object.prototype.hasOwnProperty.call(e.body,t)&&(n.push(`\`${t}\` = ?`),o.push(e.body[t]));if(0===n.length)return t.status(400).json({error:"nothing to update"});o.push(a),await r.query(`UPDATE prestations SET ${n.join(", ")} WHERE id = $1`,o);let[[s]]=await r.query(`SELECT p.*, u.email AS user_email, u.role AS user_role, u.first_name AS user_first_name, u.last_name AS user_last_name, u.telephone AS user_phone, u.address AS user_address, u.bce AS user_bce, u.company AS company_name, u.account AS user_account, an.name AS analytic_name, an.code AS analytic_code
       FROM prestations p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN analytics an ON p.analytic_id = an.id
       WHERE p.id = ? LIMIT 1`,[a]);if(!s)return t.status(404).json({error:"not found"});if(Object.prototype.hasOwnProperty.call(e.body,"status")&&"En attente d'envoie"===e.body.status&&!s.pdf_url)try{let e=i(7147),t=i(1017),a=i(8018);try{await r.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(64) DEFAULT NULL")}catch(e){}try{await r.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS request_ref VARCHAR(64) DEFAULT NULL")}catch(e){}try{await r.query("ALTER TABLE prestations ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(512) DEFAULT NULL")}catch(e){}if(!s.invoice_number)try{let e=new Date().getFullYear(),t=`${e}-%`,[i]=await r.query("SELECT invoice_number FROM prestations WHERE invoice_number LIKE $1 ORDER BY invoice_number DESC LIMIT 1",[t]),a=1;if(i&&i.length>0&&i[0].invoice_number){let e=String(i[0].invoice_number).split("-"),t=e[1]||"",r=parseInt(t.replace(/^0+/,"")||"0",10);isNaN(r)||(a=r+1)}let n=String(a).padStart(5,"0"),o=`${e}-${n}`;await r.query("UPDATE prestations SET invoice_number = ? WHERE id = $1",[o,s.id]),s.invoice_number=o}catch(e){console.warn("invoice_number generation failed",e&&e.message)}if(!s.request_ref)try{let e=new Date().getFullYear(),t=`REQ-${e}-%`,[i]=await r.query("SELECT request_ref FROM prestations WHERE request_ref LIKE $1 ORDER BY request_ref DESC LIMIT 1",[t]),a=1;if(i&&i.length>0&&i[0].request_ref){let e=String(i[0].request_ref).split("-"),t=e[2]||"",r=parseInt(t.replace(/^0+/,"")||"0",10);isNaN(r)||(a=r+1)}let n=String(a).padStart(5,"0"),o=`REQ-${e}-${n}`;await r.query("UPDATE prestations SET request_ref = ? WHERE id = $1",[o,s.id]),s.request_ref=o}catch(e){console.warn("request_ref generation failed",e&&e.message)}let n=new Date().toLocaleDateString("fr-FR"),o=s.date?(()=>{let e=new Date(s.date);return`${e.toLocaleString("fr-FR",{month:"long"})} ${e.getFullYear()}`})():"",d=null;try{let e=i(7147),t=i(1017),r=t.join(process.cwd(),"public","assets","med team logo.png"),a=t.join(process.cwd(),"public","assets","logo.png"),n=null;if(e.existsSync(r)?n=r:e.existsSync(a)&&(n=a),n){let i=e.readFileSync(n),r=(t.extname(n)||"").toLowerCase();d=`data:${".svg"===r?"image/svg+xml":".jpg"===r||".jpeg"===r?"image/jpeg":".gif"===r?"image/gif":"image/png"};base64,${i.toString("base64")}`}}catch(e){}let l=(s.pay_type||"").toString().toLowerCase(),u=s.date?new Date(s.date).toLocaleDateString("fr-FR"):n,m=1;m=l.includes("garde")?Number(s.garde_hours||0):l.includes("permanence")||l.includes("sortie")||l.includes("astreinte")?Number(s.hours_actual||0):Number(s.hours_actual||s.garde_hours||1);let c=0,p=((s.user_role||"")+"").toLowerCase(),f=s.user_role&&String(s.user_role).toUpperCase().includes("MED")||p.includes("med");if(s.remuneration_med||s.remuneration_infi)c=f?Number(s.remuneration_med||s.remuneration_infi):Number(s.remuneration_infi||s.remuneration_med);else try{let[e]=await r.query("SELECT pay_type, remuneration_infi, remuneration_med, date FROM activities WHERE analytic_id = $1 ORDER BY date DESC",[s.analytic_id]);if(e&&e.length>0){let t=null;for(let i of e){let e=(i.pay_type||"").toString().toLowerCase();if(l.includes("garde")&&e.includes("garde")||l.includes("sortie")&&(e.includes("sortie")||e.includes("permanence")||e.includes("astreinte"))||l.includes("permanence")&&e.includes("permanence")){t=i;break}}t||(t=e[0]);try{let e=f?t.remuneration_med??t.remuneration_infi:t.remuneration_infi??t.remuneration_med,i=Number(e);(!i||isNaN(i)||i<=0)&&(i=f?30:20),c=i}catch(e){c=f?30:20}}else c=f?30:20}catch(e){c=f?30:20}let _=(Number(c||0)*Number(m||0)).toFixed(2),g=Number(s.overtime_hours||0),y=Number(s.expense_amount||0),b=Number(s.garde_hours||0),h=Number(s.sortie_hours||0),x="",E=0,v=0;if(b>0){let e=await (async()=>{try{let[e]=await r.query('SELECT remuneration_infi,remuneration_med,pay_type FROM activities WHERE analytic_id = $1 AND LOWER(pay_type) LIKE "%garde%" ORDER BY date DESC LIMIT 1',[s.analytic_id]);if(e&&e.length>0){let t=f?e[0].remuneration_med??e[0].remuneration_infi:e[0].remuneration_infi??e[0].remuneration_med,i=Number(t);if(i&&!isNaN(i)&&i>0)return i}}catch(e){}return c&&Number(c)>0?Number(c):f?30:20})();E=Number((e*b).toFixed(2)),x+=`<tr><td>Prestation — ${u} — R\xe9f ${s.request_ref||"#"+s.id} / Garde</td><td>${b}</td><td>${Number(e).toString().replace(".",",")}€</td><td>${Number(E).toString().replace(".",",")}€</td></tr>`}if(h>0){let e=await (async()=>{try{let[e]=await r.query('SELECT remuneration_infi,remuneration_med,pay_type FROM activities WHERE analytic_id = $1 AND LOWER(pay_type) LIKE "%sortie%" ORDER BY date DESC LIMIT 1',[s.analytic_id]);if(e&&e.length>0){let t=f?e[0].remuneration_med??e[0].remuneration_infi:e[0].remuneration_infi??e[0].remuneration_med,i=Number(t);if(i&&!isNaN(i)&&i>0)return i}let[t]=await r.query('SELECT remuneration_infi,remuneration_med,pay_type FROM activities WHERE analytic_id = $1 AND LOWER(pay_type) LIKE "%permanence%" ORDER BY date DESC LIMIT 1',[s.analytic_id]);if(t&&t.length>0){let e=f?t[0].remuneration_med??t[0].remuneration_infi:t[0].remuneration_infi??t[0].remuneration_med,i=Number(e);if(i&&!isNaN(i)&&i>0)return i}let[i]=await r.query('SELECT remuneration_infi,remuneration_med,pay_type FROM activities WHERE analytic_id = $1 AND LOWER(pay_type) LIKE "%astreinte%" ORDER BY date DESC LIMIT 1',[s.analytic_id]);if(i&&i.length>0){let e=f?i[0].remuneration_med??i[0].remuneration_infi:i[0].remuneration_infi??i[0].remuneration_med,t=Number(e);if(t&&!isNaN(t)&&t>0)return t}}catch(e){}return c&&Number(c)>0?Number(c):f?30:20})();v=Number((e*h).toFixed(2)),x+=`<tr><td>Prestation — ${u} — R\xe9f ${s.request_ref||"#"+s.id} / Sortie</td><td>${h}</td><td>${Number(e).toString().replace(".",",")}€</td><td>${Number(v).toString().replace(".",",")}€</td></tr>`}x||(x=`<tr><td>Prestation — ${u} — R\xe9f ${s.request_ref||"#"+s.id}${s.pay_type?" / "+s.pay_type:""}</td><td>${Number(m)}</td><td>${Number(c).toString().replace(".",",")}€</td><td>${Number(_).toString().replace(".",",")}€</td></tr>`);let N=0;if(g>0){let e=await (async()=>{try{let[e]=await r.query('SELECT remuneration_infi,remuneration_med,pay_type FROM activities WHERE analytic_id = $1 AND LOWER(pay_type) LIKE "%permanence%" ORDER BY date DESC LIMIT 1',[s.analytic_id]);if(e&&e.length>0){let t=f?e[0].remuneration_med??e[0].remuneration_infi:e[0].remuneration_infi??e[0].remuneration_med,i=Number(t);if(i&&!isNaN(i)&&i>0)return i}let[t]=await r.query('SELECT remuneration_infi,remuneration_med,pay_type FROM activities WHERE analytic_id = $1 AND LOWER(pay_type) LIKE "%astreinte%" ORDER BY date DESC LIMIT 1',[s.analytic_id]);if(t&&t.length>0){let e=f?t[0].remuneration_med??t[0].remuneration_infi:t[0].remuneration_infi??t[0].remuneration_med,i=Number(e);if(i&&!isNaN(i)&&i>0)return i}}catch(e){}return c&&Number(c)>0?Number(c):f?30:20})();N=Number((e*g).toFixed(2)),x+=`<tr><td>Heures suppl\xe9mentaires (Permanence) — ${u} — R\xe9f ${s.request_ref||"#"+s.id}</td><td>${g}</td><td>${Number(e).toString().replace(".",",")}€</td><td>${Number(N).toString().replace(".",",")}€</td></tr>`}let w=0;w=b>0||h>0?Number(E||0)+Number(v||0):Number(Number(_)||0);let R=(Number(w||0)+Number(N||0)+Number(y||0)).toFixed(2),S=`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FACTURE — R\xe9f ${s.id}</title>
    <style>
    body{ font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif; color:#111; font-size:12px; margin:28px }
    .header{ display:flex; justify-content:space-between; align-items:flex-start; gap:20px }
    .left-brand{ display:flex; flex-direction:column; gap:8px; align-items:flex-start }
      .logo-wrap{ width:240px; height:240px; display:flex; align-items:center; justify-content:center; background:transparent; border:none }
      .logo-wrap img{ max-width:220px; max-height:220px; width:auto; height:auto; border-radius:0; object-fit:contain }
      .provider{ line-height:1.05 }
      .provider .name{ font-weight:800; font-size:20px }
      .provider .meta{ color:#444; margin-top:6px }
      .addresses .from{ font-size:15px; line-height:1.15; }
      .addresses .from strong{ display:block; font-size:16px; margin-bottom:6px }
      .right-meta{ text-align:right }
      .invoice-title{ font-size:26px; font-weight:800; letter-spacing:0.6px }
      .invoice-ref{ color:#444; margin-top:6px }
      .addresses{ display:flex; gap:28px; margin-top:20px }
      .right-column{ display:flex; flex-direction:column; align-items:flex-end }
      .attention{ width:240px; text-align:left; margin-top:36px; transform:translateX(-90px); padding-left:6px }
      .attention strong{ display:block; font-size:18px; font-weight:700; text-align:left }
      .attention div{ font-size:13px; text-align:left }
      .to { max-width:60% }
      .items-and-totals{ display:block; margin-top:18px }
      table.items{ width:100%; border-collapse:collapse; table-layout:fixed }
      table.items th, table.items td{ border:1px solid #ddd; padding:10px }
      table.items th{ background:#f7f7f7; text-align:left }
      table.items th:nth-child(2){ width:80px }
      table.items th:nth-child(3){ width:100px }
      table.items th:nth-child(4){ width:120px }
      table.items tfoot td{ padding:8px; border:1px solid #ddd; background:#fff }
      .footer{ clear:both; margin-top:40px; font-size:11px; color:#666 }
      .small-muted{ color:#666; font-size:12px }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="left-brand">
        <div class="logo-wrap">
          ${d?`<img src="${d}" alt="logo"/>`:"<img src=\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='76' height='76'><circle cx='38' cy='38' r='36' fill='%23fff' stroke='%23e33' stroke-width='6'/><text x='50%' y='52%' font-size='28' text-anchor='middle' fill='%23e33' font-family='Arial' dy='.3em'>+</text></svg>\" alt=\"logo\" />"}
        </div>
        <div class="provider">
          <div class="name">${((s.user_first_name||s.first_name||"")+" "+(s.user_last_name||s.last_name||"")).trim()||s.company_name||"Fournisseur"}</div>
          <div class="meta">${s.user_address||s.address||""}</div>
            <div class="meta">${s.user_bce||s.bce||""}</div>
        </div>
      </div>

      <div class="right-column">
        <div class="right-meta">
          <div class="invoice-title">FACTURE</div>
          <div class="invoice-ref">R\xe9f\xe9rence : ${s.analytic_code||""}</div>
          <div class="invoice-ref">Facture No : ${s.invoice_number||""}</div>
          <div class="invoice-ref">Date : ${n}</div>
          <div class="invoice-ref">Compte : ${s.user_account||s.account||"-"}</div>
        </div>
        <div class="attention">
          <strong>A L'attention de :</strong>
          <div>Croix-Rouge de Belgique</div>
          <div>Medical Team Bruxelles Capitale</div>
          <div class="small-muted">Rue Rempart des Moines 78, 1000&nbsp;Bruxelles</div>
        </div>
      </div>
    </div>

    <div class="addresses">
      <div class="to">
        <strong>Objet :</strong>
        <div>${(s.pay_type||"")+(s.analytic_name||s.analytic_code?" — "+(s.analytic_name||s.analytic_code)+(o?" "+o:""):"")}</div>
      </div>
    </div>

    <div class="items-and-totals">
      <table class="items">
      <thead>
        <tr>
          <th>D\xe9signation</th>
          <th>Nb d'heure</th>
          <th>Prix/h</th>
          <th>Montant HT</th>
        </tr>
      </thead>
      <tbody>
        ${x}
        ${Number(s.expense_amount||0)>0?"<tr><td>Note de frais"+(s.expense_comment?" — "+s.expense_comment:"")+"</td><td></td><td></td><td>"+Number(Number(s.expense_amount||0)).toFixed(2).toString().replace(".",",")+"€</td></tr>":""}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right; background:#fff">TVA</td>
          <td style="background:#fff">Non applicable</td>
        </tr>
        <tr>
          <td colspan="3" style="text-align:right; font-weight:700; background:#fff">Total</td>
          <td style="font-weight:700; background:#fff">${Number(R).toString().replace(".",",")}€</td>
        </tr>
      </tfoot>
      </table>
    </div>

    <div class="footer">
      <div>Pri\xe8re de r\xe9gler ce montant par virement bancaire sur le compte suivant : ${s.user_account||s.account||"BE18063402145665"}</div>
      <div style="margin-top:8px">En renseignant votre num\xe9ro de facture : ${s.invoice_number||""} en communication.</div>
      <div style="margin-top:18px">Commentaires :</div>
      <div style="white-space:pre-wrap">${(s.comments||"-").toString()}</div>
    </div>
  </body>
</html>`,$=await a.launch({args:["--no-sandbox","--disable-setuid-sandbox"]}),L=await $.newPage();await L.setContent(S,{waitUntil:"networkidle0"});let A=await L.pdf({format:"A4",printBackground:!0}),T=t.join(process.cwd(),"public","exports");e.existsSync(T)||e.mkdirSync(T,{recursive:!0});let D=`prestation-${s.id}-${Date.now()}.pdf`,C=t.join(T,D);e.writeFileSync(C,A);let O=`/exports/${D}`;await r.query("UPDATE prestations SET pdf_url = ? WHERE id = $1",[O,s.id]),s.pdf_url=O,await $.close()}catch(e){console.error("pdf generation failed",e&&e.message)}return t.status(200).json(s)}catch(e){return console.error("admin prestations [id] error",e),t.status(500).json({error:"internal"})}}let d=(0,o.l)(r,"default"),l=(0,o.l)(r,"config"),u=new a.PagesAPIRouteModule({definition:{kind:n.x.PAGES_API,page:"/api/admin/prestations/[id]",pathname:"/api/admin/prestations/[id]",bundlePath:"",filename:""},userland:r})}};var t=require("../../../../webpack-api-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),i=t.X(0,[4222,6541],()=>__webpack_exec__(7665));module.exports=i})();