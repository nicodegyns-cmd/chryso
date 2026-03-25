'use client';

import React, { useState, useEffect } from 'react';
import AdminHeader from '../../components/AdminHeader';
import AdminSidebar from '../../components/AdminSidebar';
import './rib-validation.css';

export default function RIBValidation() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [validationInProgress, setValidationInProgress] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPendingDocuments();
  }, []);

  const fetchPendingDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/documents/pending');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setMessage('Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (documentId, status) => {
    if (status === 'rejected' && !rejectionReason.trim()) {
      setMessage('Veuillez ajouter une raison de rejet');
      return;
    }

    try {
      setValidationInProgress(true);
      const response = await fetch('/api/admin/documents/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          status,
          reason: status === 'rejected' ? rejectionReason : null
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`✅ Document ${status === 'approved' ? 'validé' : 'rejeté'} avec succès`);
        setSelectedDoc(null);
        setRejectionReason('');
        fetchPendingDocuments();
      } else {
        setMessage(`❌ Erreur: ${data.error}`);
      }
    } catch (error) {
      console.error('Error validating document:', error);
      setMessage('❌ Erreur lors de la validation');
    } finally {
      setValidationInProgress(false);
    }
  };

  return (
    <div className="admin-layout">
      <AdminHeader />
      <div className="admin-content">
        <AdminSidebar />
        <div className="admin-main">
          <div className="rib-validation-container">
            <h1>📋 Validation des Documents RIB</h1>

            {message && (
              <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}

            {loading ? (
              <div className="loading">Chargement des documents...</div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <p>✅ Aucun document en attente de validation</p>
              </div>
            ) : (
              <div className="documents-grid">
                {documents.map(doc => (
                  <div 
                    key={doc.id} 
                    className={`document-card ${selectedDoc?.id === doc.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className="doc-header">
                      <div className="doc-type-badge">📄 {doc.type}</div>
                      <div className="doc-date">{new Date(doc.created_at).toLocaleDateString('fr-FR')}</div>
                    </div>

                    <div className="user-info">
                      <h3>{doc.user_name}</h3>
                      <p className="email">📧 {doc.email}</p>
                      <p className="phone">📱 {doc.phone}</p>
                      {doc.company_name && <p className="company">🏢 {doc.company_name}</p>}
                      {doc.city && <p className="city">📍 {doc.city}</p>}
                    </div>

                    <div className="doc-filename">
                      <strong>Fichier:</strong> {doc.name}
                    </div>

                    <div className="doc-size">
                      <strong>Taille:</strong> {(doc.file_size / 1024).toFixed(2)} KB
                    </div>

                    <div className="status-badge pending">⏳ En attente</div>
                  </div>
                ))}
              </div>
            )}

            {selectedDoc && (
              <div className="validation-panel">
                <div className="panel-header">
                  <h2>Valider le document</h2>
                  <button 
                    className="close-btn" 
                    onClick={() => {
                      setSelectedDoc(null);
                      setRejectionReason('');
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div className="panel-content">
                  <div className="user-full-info">
                    <h3>👤 Informations de l'utilisateur</h3>
                    <div className="info-row">
                      <span className="label">Nom:</span>
                      <span>{selectedDoc.user_name}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Email:</span>
                      <span>{selectedDoc.email}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Téléphone:</span>
                      <span>{selectedDoc.phone}</span>
                    </div>
                    {selectedDoc.company_name && (
                      <div className="info-row">
                        <span className="label">Entreprise:</span>
                        <span>{selectedDoc.company_name}</span>
                      </div>
                    )}
                    {selectedDoc.city && (
                      <div className="info-row">
                        <span className="label">Ville:</span>
                        <span>{selectedDoc.city}</span>
                      </div>
                    )}
                  </div>

                  <div className="document-preview">
                    <h3>📎 Aperçu du document</h3>
                    <div className="document-info">
                      <p><strong>Nom:</strong> {selectedDoc.name}</p>
                      <p><strong>Type:</strong> {selectedDoc.type}</p>
                      <p><strong>Taille:</strong> {(selectedDoc.file_size / 1024).toFixed(2)} KB</p>
                      <p><strong>Date d'upload:</strong> {new Date(selectedDoc.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                    <a 
                      href={selectedDoc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="view-document-btn"
                    >
                      👁️ Voir le PDF
                    </a>
                  </div>

                  {validationInProgress && (
                    <div className="validation-section">
                      <label>Raison du rejet:</label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Expliquez pourquoi ce document est rejeté..."
                        rows="4"
                      />
                    </div>
                  )}

                  <div className="validation-actions">
                    <button
                      className="btn-approve"
                      onClick={() => handleValidate(selectedDoc.id, 'approved')}
                      disabled={validationInProgress}
                    >
                      ✅ Valider le document
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => {
                        if (!validationInProgress) {
                          setValidationInProgress(true);
                        } else {
                          handleValidate(selectedDoc.id, 'rejected');
                        }
                      }}
                      disabled={validationInProgress && !rejectionReason.trim()}
                    >
                      {validationInProgress ? '❌ Confirmer le rejet' : '❌ Rejeter le document'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
