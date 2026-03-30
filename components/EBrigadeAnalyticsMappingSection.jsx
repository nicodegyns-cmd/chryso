import React, { useState, useEffect } from 'react'

export default function EBrigadeAnalyticsMappingSection() {
  const [ebrigadeAnalytics, setEbrigadeAnalytics] = useState([])
  const [mappings, setMappings] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [selectedEbrigade, setSelectedEbrigade] = useState('')
  const [selectedAnalytic, setSelectedAnalytic] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      // Load existing mappings
      const mappingRes = await fetch('/api/admin/ebrigade-analytics-mapping')
      if (mappingRes.ok) {
        const mappingData = await mappingRes.json()
        setMappings(mappingData.mappings || [])
      }

      // Load local analytics
      const analyticsRes = await fetch('/api/admin/analytics')
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json()
        setAnalytics(analyticsData.items || [])
      }

      // Load available eBrigade analytics from sample data
      // We need to fetch from activities API to see what eBrigade analytics exist
      // For now, we'll add them manually when user first interacts
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadEbrigadeAnalytics() {
    // This would be called when user clicks to see available eBrigade analytics
    // We could fetch from a new endpoint that returns all unique eBrigade analytics from activities
    // For MVP, user will type in the name
  }

  async function handleAddMapping() {
    if (!selectedEbrigade || !selectedAnalytic) {
      setError('Sélectionnez une analytique eBrigade et une analytique locale')
      return
    }

    // Check if already mapped
    if (mappings.find(m => m.ebrigade_analytic_name === selectedEbrigade)) {
      setError('Cette analytique eBrigade est déjà mappée')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/admin/ebrigade-analytics-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ebrigade_analytic_name: selectedEbrigade,
          local_analytic_id: parseInt(selectedAnalytic)
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la création')
      }

      await loadData()
      setSelectedEbrigade('')
      setSelectedAnalytic('')
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMapping(id) {
    if (!confirm('Supprimer ce mapping ?')) return

    try {
      setSaving(true)
      const res = await fetch('/api/admin/ebrigade-analytics-mapping', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }

      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        padding: 20,
        background: '#f9fafb',
        borderRadius: 8,
        marginBottom: 24,
        textAlign: 'center',
        color: '#6b7280'
      }}>
        Chargement des mappings...
      </div>
    )
  }

  // Get unmapped eBrigade analytics
  const mappedNames = mappings.map(m => m.ebrigade_analytic_name)

  return (
    <div style={{
      padding: 20,
      background: '#f0f9ff',
      border: '2px solid #0ea5e9',
      borderRadius: 8,
      marginBottom: 24
    }}>
      <h2 style={{
        margin: '0 0 16px 0',
        fontSize: 18,
        fontWeight: 700,
        color: '#1f2937'
      }}>
        🔗 Mappings eBrigade → Analytiques locales
      </h2>

      <p style={{
        margin: '0 0 16px 0',
        fontSize: 13,
        color: '#4b5563'
      }}>
        Associez les noms d'analytiques eBrigade avec vos analytiques locales. Chaque activité eBrigade utilisera automatiquement l'analytique locale mappée.
      </p>

      {error && (
        <div style={{
          padding: 12,
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 6,
          color: '#991b1b',
          marginBottom: 16,
          fontSize: 13
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Add new mapping form */}
      <div style={{
        padding: 16,
        background: 'white',
        border: '1px solid #bfdbfe',
        borderRadius: 6,
        marginBottom: 16
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
          Ajouter un nouveau mapping
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 12,
          alignItems: 'flex-end'
        }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280'
            }}>
              Analytique eBrigade *
            </label>
            <input
              type="text"
              value={selectedEbrigade}
              onChange={(e) => setSelectedEbrigade(e.target.value)}
              placeholder="Ex: Permanence INFI | 07h -14h"
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13
              }}
              list="ebrigade-list"
            />
            <datalist id="ebrigade-list">
              {mappings.map(m => (
                <option key={m.ebrigade_analytic_name} value={m.ebrigade_analytic_name} disabled />
              ))}
            </datalist>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280'
            }}>
              Analytique locale *
            </label>
            <select
              value={selectedAnalytic}
              onChange={(e) => setSelectedAnalytic(e.target.value)}
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13
              }}
            >
              <option value="">-- Sélectionner --</option>
              {analytics.map(a => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAddMapping}
            disabled={saving || !selectedEbrigade || !selectedAnalytic}
            style={{
              padding: '8px 16px',
              background: selectedEbrigade && selectedAnalytic ? '#3b82f6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: selectedEbrigade && selectedAnalytic ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              fontSize: 13,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (selectedEbrigade && selectedAnalytic) {
                e.target.style.background = '#2563eb'
              }
            }}
            onMouseLeave={(e) => {
              if (selectedEbrigade && selectedAnalytic) {
                e.target.style.background = '#3b82f6'
              }
            }}
          >
            {saving ? 'Ajout...' : '✓ Ajouter'}
          </button>
        </div>
      </div>

      {/* Existing mappings table */}
      <div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
          Mappings existants ({mappings.length})
        </h3>

        {mappings.length === 0 ? (
          <div style={{
            padding: 16,
            background: 'white',
            borderRadius: 6,
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: 13
          }}>
            Aucun mapping configuré. Commencez par en ajouter un ci-dessus.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                  background: 'white',
                  borderBottom: '2px solid #bfdbfe'
                }}>
                  <th style={{
                    padding: 12,
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#4b5563'
                  }}>
                    Analytique eBrigade
                  </th>
                  <th style={{
                    padding: 12,
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#4b5563'
                  }}>
                    → Analytique locale
                  </th>
                  <th style={{
                    padding: 12,
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#4b5563'
                  }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id} style={{
                    borderBottom: '1px solid #dbeafe',
                    background: 'white',
                    transition: 'background 0.2s',
                    ':hover': { background: '#f0f9ff' }
                  }}>
                    <td style={{
                      padding: 12,
                      fontSize: 13,
                      color: '#1f2937'
                    }}>
                      <code style={{
                        background: '#dbeafe',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 12
                      }}>
                        {mapping.ebrigade_analytic_name}
                      </code>
                    </td>
                    <td style={{
                      padding: 12,
                      fontSize: 13,
                      color: '#059669',
                      fontWeight: 500
                    }}>
                      {mapping.analytic_code} - {mapping.analytic_name}
                    </td>
                    <td style={{ padding: 12 }}>
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        disabled={saving}
                        style={{
                          padding: '6px 12px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                        onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                      >
                        🗑️ Supprimer
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
