import React, { useState, useEffect } from 'react'
import UserTable from '../../components/UserTable'
import EBrigadeSyncUsers from '../../components/EBrigadeSyncUsers'
import AdminHeader from '../../components/AdminHeader'
import AdminSidebar from '../../components/AdminSidebar'

export default function AdminUsersPage(){
  const [showSync, setShowSync] = useState(false)
  const [pendingCount, setPendingCount] = useState(null)
  const [loadingCount, setLoadingCount] = useState(true)

  // Load pending count on mount
  useEffect(() => {
    loadPendingCount()
  }, [])

  async function loadPendingCount() {
    setLoadingCount(true)
    try {
      const resp = await fetch('/api/admin/users/pending-count')
      if (resp.ok) {
        const data = await resp.json()
        setPendingCount(data.pendingCount)
      } else {
        setPendingCount(0)
      }
    } catch (err) {
      console.error('Error loading pending count:', err)
      setPendingCount(0)
    } finally {
      setLoadingCount(false)
    }
  }

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
            style={{ 
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {showSync ? 'Annuler' : '+ Nouveau utilisateur'}
            {pendingCount !== null && pendingCount > 0 && (
              <span style={{
                backgroundColor: '#1e40af',
                borderRadius: '999px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: '600',
                minWidth: '24px',
                textAlign: 'center'
              }}>
                {loadingCount ? '...' : pendingCount}
              </span>
            )}
          </button>
        </div>

        {showSync && (
          <div className="admin-card card" style={{ marginBottom: '20px' }}>
            <EBrigadeSyncUsers 
              pendingCount={pendingCount}
              loadingCount={loadingCount}
              onSyncComplete={loadPendingCount}
              autoShowConfirm={true}
            />
          </div>
        )}

        <div className="admin-card card">
          <UserTable />
        </div>
      </main>
    </div>
  )
}
