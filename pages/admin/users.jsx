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
        <div className="admin-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px'}}>
          <div>
            <h1 style={{margin: '0 0 4px 0'}}>Utilisateurs</h1>
            <div className="small-muted">Gérer les comptes utilisateurs</div>
          </div>
          <button 
            onClick={() => setShowSync(!showSync)}
            style={{ 
              padding: '12px 24px',
              background: showSync 
                ? '#ef4444'  // Red for cancel
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',  // Gradient for sync
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => !showSync && (e.target.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            {showSync ? 'Annuler' : '+ Nouveau utilisateur'}
            {pendingCount !== null && pendingCount > 0 && !showSync && (
              <span style={{
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '999px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: '600',
                minWidth: '24px',
                textAlign: 'center',
                color: 'white'
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
