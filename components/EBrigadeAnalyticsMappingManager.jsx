import React, { useState, useEffect } from 'react'

export default function EBrigadeAnalyticsMappingManager() {
  const [mappings, setMappings] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  // Form state
  const [formMode, setFormMode] = useState('add') // 'add' or 'edit'
  const [editingId, setEditingId] = useState(null)
  const [ebrigadeName, setEbrigadeName] = useState('')
  const [selectedAnalyticId, setSelectedAnalyticId] = useState('')

  useEffect(() => {
    loadMappingsAndAnalytics()
  }, [])

  async function loadMappingsAndAnalytics() {
    try {
      setLoading(true)
      // Load mappings
      const mappingRes = await fetch('/api/admin/ebrigade-analytics-mapping')
      if (!mappingRes.ok) throw new Error('Failed to load mappings')
      const mappingData = await mappingRes.json()
      setMappings(mappingData.mappings || [])

      // Load available analytics
      const analyticsRes = await fetch('/api/admin/analytics')
      if (!analyticsRes.ok) throw new Error('Failed to load analytics')
      const analyticsData = await analyticsRes.json()
      setAnalytics(analyticsData.items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!ebrigadeName.trim() || !selectedAnalyticId) {
      setError('Tous les champs sont requis')
      return
    }

    try {
      setSaving(true)
      const method = formMode === 'add' ? 'POST' : 'PUT'
      const body = {
        ebrigade_analytic_name: ebrigadeName.trim(),
        local_analytic_id: parseInt(selectedAnalyticId)
      }
      if (formMode === 'edit') {
        body.id = editingId
      }

      const res = await fetch('/api/admin/ebrigade-analytics-mapping', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Erreur lors de la sauvegarde')
      }

      await loadMappingsAndAnalytics()
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce mapping ?')) return

    try {
      setSaving(true)
      const res = await fetch('/api/admin/ebrigade-analytics-mapping', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Erreur lors de la suppression')
      }

      await loadMappingsAndAnalytics()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setFormMode('add')
    setEditingId(null)
    setEbrigadeName('')
    setSelectedAnalyticId('')
    setError(null)
  }

  function handleEdit(mapping) {
    setFormMode('edit')
    setEditingId(mapping.id)
    setEbrigadeName(mapping.ebrigade_analytic_name)
    setSelectedAnalyticId(mapping.local_analytic_id.toString())
  }

  if (loading) return <div style={{ padding: 20 }}>Chargement...</div>

  const getAnalyticName = (id) => {
    const analytic = analytics.find(a => a.id === id)
    return analytic ? `${analytic.analytic_code} - ${analytic.analytic_name}` : 'Non trouvé'
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Gestion des Mappings eBrigade → Analytiques</h2>

      {error && (
        <div style={{
          padding: 12,
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 6,
          color: '#991b1b',
          marginBottom: 20
        }}>
          {error}
        </div>
      )}

      {/* Form Section */}
      <div style={{
        padding: 16,
        background: '#f0f9ff',
        border: '1px solid #bfdbfe',
        borderRadius: 8,
        marginBottom: 24
      }}>
        <h3 style={{ margin: '0 0 16px 0' }}>
          {formMode === 'add' ? 'Nouvel association' : 'Modifier association'}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
              Nom analytique eBrigade *
            </label>
            <input
              type="text"
              value={ebrigadeName}
              onChange={(e) => setEbrigadeName(e.target.value)}
              placeholder="Ex: Permanence INFI | 07h -14h"
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
              Analytique locale *
            </label>
            <select
              value={selectedAnalyticId}
              onChange={(e) => setSelectedAnalyticId(e.target.value)}
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">-- Sélectionner --</option>
              {analytics.map(a => (
                <option key={a.id} value={a.id}>
                  {a.analytic_code} - {a.analytic_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          {formMode === 'edit' && (
            <button
              onClick={resetForm}
              style={{
                padding: '8px 16px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div>
        <h3 style={{ marginBottom: 12 }}>Mappings existants ({mappings.length})</h3>
        {mappings.length === 0 ? (
          <div style={{ padding: 20, background: '#f3f4f6', borderRadius: 6, textAlign: 'center', color: '#6b7280' }}>
            Aucun mapping configuré
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'white'
            }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>eBrigade Analytique</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Analytique Locale</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: 12 }}>
                      <code style={{ background: '#f0f9ff', padding: '4px 8px', borderRadius: 4 }}>
                        {mapping.ebrigade_analytic_name}
                      </code>
                    </td>
                    <td style={{ padding: 12 }}>
                      {mapping.analytic_code} - {mapping.analytic_name}
                    </td>
                    <td style={{ padding: 12, display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleEdit(mapping)}
                        style={{
                          padding: '6px 12px',
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(mapping.id)}
                        disabled={saving}
                        style={{
                          padding: '6px 12px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
