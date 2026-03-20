import { useEffect } from 'react'

export default function RoleSelectorModal({ open, onClose, roles = [], onSelect }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-header">
          <h3>Sélectionner un rôle</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">
          {roles.length === 0 && <p className="muted">Aucun rôle disponible</p>}
          <ul className="role-list">
            {roles.map((r) => (
              <li key={r}>
                <button className="role-item" onClick={() => { onSelect?.(r); onClose() }}>{r}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
