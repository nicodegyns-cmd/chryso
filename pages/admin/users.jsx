import React, { useState } from 'react'
import UserTable from '../../components/UserTable'
import EBrigadeSyncUsers from '../../components/EBrigadeSyncUsers'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function AdminUsersPage(){
  const [showSync, setShowSync] = useState(false)

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
            onClick={() => setShowSync(!showSync)}
            style={{ marginLeft: 'auto' }}
          >
            {showSync ? 'Annuler' : '+ Nouveau utilisateur'}
          </button>
        </div>

        {showSync && (
          <div className="admin-card card" style={{ marginBottom: '20px' }}>
            <EBrigadeSyncUsers />
          </div>
        )}

        <div className="admin-card card">
          <UserTable />
        </div>
      </main>
    </div>
  )
}
