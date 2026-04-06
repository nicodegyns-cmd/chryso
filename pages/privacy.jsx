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

        <article style={{background:'#fff',padding:24,borderRadius:10,boxShadow:'0 4px 20px rgba(2,6,23,0.06)'}}>
          <p>La politique de confidentialité décrit comment nous collectons, utilisons et protégeons les données personnelles des utilisateurs. Elle inclut les finalités, les durées de conservation, les droits des personnes concernées et les moyens de contact pour exercer ces droits.</p>
          <p>Si vous souhaitez que j'ajoute le texte complet de la politique, fournissez-le et je le mettrai en forme ici.</p>
        </article>
      </main>
    </div>
  )
}
