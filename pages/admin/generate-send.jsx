import React from 'react'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'
import GenerateSendTable from '../../components/GenerateSendTable'

export default function GenerateSendPage(){
  return (
    <div className="admin-page-root">
      <AdminHeader />
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1>Générer & Envoyer</h1>
          <div className="small-muted">Sélectionnez une activité et lancez la génération / envoi.</div>
        </div>
        <div className="admin-card card">
          <GenerateSendTable />
        </div>
      </main>
    </div>
  )
}
