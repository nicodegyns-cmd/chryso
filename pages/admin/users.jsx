import React, { useState } from 'react'
import UserTable from '../../components/UserTable'
import BulkImportUsers from '../../components/BulkImportUsers'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function AdminUsersPage(){
  const [showImport, setShowImport] = useState(false)

  return (
    <div className="admin-page-root">
      <AdminHeader />
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1>Utilisateurs</h1>
          <div className="small-muted">Gérer les comptes utilisateurs</div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowImport(!showImport)}
            style={{ marginLeft: 'auto' }}
          >
            {showImport ? 'Annuler import' : '+ Importer CSV'}
          </button>
        </div>

        {showImport && (
          <div className="admin-card card" style={{ marginBottom: '20px' }}>
            <BulkImportUsers />
          </div>
        )}

        <div className="admin-card card">
          <UserTable />
        </div>
      </main>
    </div>
  )
}
