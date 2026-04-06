import React from 'react'
import AdminHeader from '../components/AdminHeader'

export default function PrivacyPage(){
  const appName = process.env.NEXT_PUBLIC_APP_NAME || process.env.APP_NAME || 'Fénix'
  const logoPath = '/assets/logo.png'

  return (
    <div className="privacy-root">
      <AdminHeader />
      <main style={{maxWidth:900,margin:'40px auto',padding:'20px'}}>
        <header style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
          <img src={logoPath} alt={`${appName} logo`} style={{width:72,height:72,objectFit:'contain',borderRadius:8}}/>
          <div>
            <h1 style={{margin:0,fontSize:28,color:'#0f172a'}}>Politique de confidentialité</h1>
            <div style={{color:'#6b7280',marginTop:6}}>Respect de vos données personnelles</div>
          </div>
        </header>

        <article style={{background:'#fff',padding:24,borderRadius:10,boxShadow:'0 4px 20px rgba(2,6,23,0.06)',lineHeight:1.8,color:'#1f2937'}}>
          
          <section style={{marginBottom:28}}>
            <h2 style={{fontSize:20,fontWeight:600,color:'#0f172a',marginBottom:12}}>1. Données collectées</h2>
            <p style={{margin:'0 0 8px 0'}}>Nous collectons les données suivantes :</p>
            <ul style={{marginLeft:20,marginTop:8,marginBottom:0}}>
              <li>Informations d'identification (nom, prénom, email)</li>
              <li>Informations professionnelles (prestations, heures travaillées)</li>
              <li>Données de facturation</li>
            </ul>
          </section>

          <section style={{marginBottom:28}}>
            <h2 style={{fontSize:20,fontWeight:600,color:'#0f172a',marginBottom:12}}>2. Finalités</h2>
            <p style={{margin:'0 0 8px 0'}}>Les données sont collectées pour :</p>
            <ul style={{marginLeft:20,marginTop:8,marginBottom:0}}>
              <li>Gérer les comptes utilisateurs</li>
              <li>Enregistrer les prestations</li>
              <li>Permettre la validation des heures</li>
              <li>Générer des documents de facturation</li>
              <li>Répondre aux obligations légales comptables</li>
            </ul>
          </section>

          <section style={{marginBottom:28}}>
            <h2 style={{fontSize:20,fontWeight:600,color:'#0f172a',marginBottom:12}}>3. Base légale</h2>
            <p>Le traitement est nécessaire à l'exécution du service (relation contractuelle).</p>
          </section>

          <section style={{marginBottom:28}}>
            <h2 style={{fontSize:20,fontWeight:600,color:'#0f172a',marginBottom:12}}>4. Accès aux données</h2>
            <p style={{margin:'0 0 8px 0'}}>Les données sont accessibles uniquement :</p>
            <ul style={{marginLeft:20,marginTop:8,marginBottom:0}}>
              <li>À l'utilisateur concerné</li>
              <li>Aux utilisateurs habilités (modérateurs, comptabilité, admin)</li>
            </ul>
          </section>

          <section style={{marginBottom:28}}>
            <h2 style={{fontSize:20,fontWeight:600,color:'#0f172a',marginBottom:12}}>5. Durée de conservation</h2>
            <p style={{margin:'0 0 8px 0'}}>Les données sont conservées :</p>
            <ul style={{marginLeft:20,marginTop:8,marginBottom:0}}>
              <li>Pendant la durée d'utilisation du service</li>
              <li>Puis archivées conformément aux obligations légales (notamment comptables)</li>
            </ul>
          </section>

          <section style={{marginBottom:28}}>
            <h2 style={{fontSize:20,fontWeight:600,color:'#0f172a',marginBottom:12}}>6. Sécurité</h2>
            <p>Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger les données.</p>
          </section>

          <section style={{marginBottom:28}}>
            <h2 style={{fontSize:20,fontWeight:600,color:'#0f172a',marginBottom:12}}>7. Droits des utilisateurs</h2>
            <p style={{margin:'0 0 8px 0'}}>Conformément à la réglementation, vous disposez des droits suivants :</p>
            <ul style={{marginLeft:20,marginTop:8,marginBottom:0}}>
              <li>Accès</li>
              <li>Rectification</li>
              <li>Suppression</li>
              <li>Limitation</li>
            </ul>
          </section>

          <section style={{marginBottom:0,padding:20,background:'#f3f4f6',borderRadius:8,borderLeft:'4px solid #f97316'}}>
            <h2 style={{fontSize:20,fontWeight:600,color:'#0f172a',marginBottom:12}}>8. Contact</h2>
            <p style={{margin:0}}>Pour toute question relative aux données personnelles :<br/><strong style={{color:'#f97316'}}>adminfenix@nexio7.be</strong></p>
          </section>

        </article>
      </main>
    </div>
  )
}
