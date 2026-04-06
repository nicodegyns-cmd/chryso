import React from 'react'
import AdminHeader from '../components/AdminHeader'

export default function CGUPage(){
  const appName = process.env.NEXT_PUBLIC_APP_NAME || process.env.APP_NAME || 'Fénix'
  const logoPath = '/assets/logo.png'

  return (
    <div className="cgu-root">
      <AdminHeader />
      <main style={{maxWidth:900,margin:'40px auto',padding:'20px'}}>
        <header style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
          <img src={logoPath} alt={`${appName} logo`} style={{width:72,height:72,objectFit:'contain',borderRadius:8,boxShadow:'0 6px 18px rgba(0,0,0,0.08)'}}/>
          <div>
            <h1 style={{margin:0,fontSize:28,color:'#0f172a'}}>{appName} — Conditions d'utilisation</h1>
            <div style={{color:'#6b7280',marginTop:6}}>Version en vigueur • Merci de lire attentivement</div>
          </div>
        </header>

        <article style={{background:'#fff',padding:24,borderRadius:10,boxShadow:'0 4px 20px rgba(2,6,23,0.06)'}}>
          <section>
            <h2>1. Objet</h2>
            <p>La présente application permet aux prestataires de renseigner leurs heures de prestation, lesquelles peuvent être validées par des utilisateurs habilités, puis utilisées pour générer des documents de facturation.</p>
          </section>

          <section>
            <h2>2. Création de compte</h2>
            <p>L’utilisateur s’engage à fournir des informations exactes lors de son inscription et à les maintenir à jour.</p>
          </section>

          <section>
            <h2>3. Utilisation du service</h2>
            <p>L’utilisateur s’engage à :</p>
            <ul>
              <li>renseigner des informations exactes concernant ses prestations</li>
              <li>ne pas utiliser l’application à des fins frauduleuses ou illégales</li>
              <li>respecter les procédures de validation mises en place</li>
            </ul>
          </section>

          <section>
            <h2>4. Règles d’usage et interdictions</h2>
            <p>Afin de garantir le bon fonctionnement de l’application, l’utilisateur s’engage à ne pas :</p>
            <ul>
              <li>saisir des informations fausses, inexactes ou trompeuses (notamment sur les heures prestées)</li>
              <li>tenter de contourner les mécanismes de validation mis en place</li>
              <li>accéder ou tenter d’accéder à des données qui ne lui sont pas autorisées</li>
              <li>utiliser le service à des fins frauduleuses ou illégales</li>
              <li>perturber le bon fonctionnement de l’application (tentatives d’intrusion, surcharge, etc.)</li>
              <li>partager ses identifiants avec des tiers</li>
            </ul>
            <p>Toute utilisation abusive ou contraire aux présentes règles pourra entraîner la suspension temporaire du compte, la suppression du compte et, le cas échéant, des poursuites.</p>
          </section>

          <section>
            <h2>5. Validation des prestations</h2>
            <p>Les heures saisies peuvent être soumises à validation par un utilisateur disposant des droits appropriés. La validation conditionne leur prise en compte dans les documents de facturation.</p>
          </section>

          <section>
            <h2>6. Responsabilité</h2>
            <p>L’utilisateur est seul responsable des données qu’il saisit et de l’exactitude des informations transmises. L’éditeur de l’application ne pourra être tenu responsable en cas d’erreurs dans les données fournies.</p>
          </section>

          <section>
            <h2>7. Génération de documents</h2>
            <p>L’application permet la génération de documents (ex : factures) à partir des données saisies et validées. Ces documents doivent être vérifiés avant toute utilisation officielle.</p>
          </section>

          <section>
            <h2>8. Accès et sécurité</h2>
            <p>L’utilisateur est responsable de la confidentialité de ses identifiants. Toute utilisation de son compte est réputée effectuée par lui.</p>
          </section>

          <section>
            <h2>9. Suspension ou suppression de compte</h2>
            <p>L’éditeur se réserve le droit de suspendre ou supprimer un compte en cas de non-respect des présentes conditions.</p>
          </section>

          <section>
            <h2>10. Données personnelles</h2>
            <p>Les données personnelles sont traitées conformément à la politique de confidentialité.</p>
          </section>

          <section>
            <h2>11. Droit applicable</h2>
            <p>Les présentes conditions sont soumises au droit belge.</p>
          </section>

          <footer style={{marginTop:18,color:'#6b7280',fontSize:13}}>
            <p>Si vous avez des questions concernant ces conditions, contactez l’administrateur de l’application.</p>
          </footer>
        </article>
      </main>
    </div>
  )
}
