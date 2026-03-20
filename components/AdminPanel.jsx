import React, { useState } from 'react'
import AdminHeader from './AdminHeader'
import AdminSidebar from './AdminSidebar'
import RoleSelectorModal from './RoleSelectorModal'
import AdminPrestationsSummary from './AdminPrestationsSummary'

export default function AdminPanel() {
  const [modalOpen, setModalOpen] = useState(false)
  const roles = ['admin', 'moderator', 'user']

  function handleSelectRole(r) {
    // placeholder: in real app call API to change effective role or filter view
    console.log('Selected role', r)
  }

  return (
    <div className="admin-root">
      <AdminHeader onOpenRoles={() => setModalOpen(true)} />

      <AdminSidebar onNavigate={(id) => console.log('nav to', id)} />

      <div className="admin-content">
        <header className="admin-header">
          <h1>Tableau de bord Admin</h1>
          <p className="muted">Gestion des demandes de prestations</p>
        </header>

        <section>
          <AdminPrestationsSummary />
        </section>
      </div>

      <RoleSelectorModal open={modalOpen} onClose={() => setModalOpen(false)} roles={roles} onSelect={handleSelectRole} />
    </div>
  )
}
