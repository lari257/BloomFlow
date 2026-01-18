import React, { useState, useEffect } from 'react'
import { getPendingApprovals, approveFlorar, rejectFlorar } from '../../services/users'
import '../../styles/components.css'

const PendingApprovals = () => {
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(null)

  useEffect(() => {
    fetchPendingApprovals()
  }, [])

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true)
      const response = await getPendingApprovals()
      setPendingUsers(response.pending_users || [])
    } catch (err) {
      setError(err.message || 'Failed to load pending approvals')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId, email) => {
    if (!window.confirm(`Are you sure you want to approve ${email} as a florist?`)) {
      return
    }

    setActionLoading(userId)
    try {
      const response = await approveFlorar(userId)
      
      // Show success message with Keycloak status
      const keycloakStatus = response.keycloak_updated 
        ? '✅ Keycloak role updated' 
        : '⚠️ Keycloak role update failed'
      
      alert(`${email} has been approved as a florist!\n${keycloakStatus}`)
      
      // Remove from list
      setPendingUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err) {
      alert(`Failed to approve: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (userId) => {
    setActionLoading(userId)
    try {
      await rejectFlorar(userId, rejectReason)
      alert('Request rejected successfully')
      setPendingUsers(prev => prev.filter(u => u.id !== userId))
      setShowRejectModal(null)
      setRejectReason('')
    } catch (err) {
      alert(`Failed to reject: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading pending approvals...</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🔐 Pending Florist Approvals</h1>
        <button onClick={fetchPendingApprovals} className="btn btn-outline">
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="form-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {pendingUsers.length === 0 ? (
        <div className="empty-state" style={{ 
          textAlign: 'center', 
          padding: '3rem', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '8px' 
        }}>
          <h3>✨ No Pending Approvals</h3>
          <p>All florist requests have been processed.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Requested Role</th>
                <th>Requested At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="badge badge-warning">
                      💐 {user.requested_role}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleApprove(user.id, user.email)}
                        className="btn btn-success btn-sm"
                        disabled={actionLoading === user.id}
                      >
                        {actionLoading === user.id ? '...' : '✅ Approve'}
                      </button>
                      <button
                        onClick={() => setShowRejectModal(user.id)}
                        className="btn btn-danger btn-sm"
                        disabled={actionLoading === user.id}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3>Reject Request</h3>
            <p>Please provide a reason for rejection (optional):</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="form-input"
              rows={3}
              placeholder="Enter rejection reason..."
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRejectModal(null)
                  setRejectReason('')
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                className="btn btn-danger"
                disabled={actionLoading === showRejectModal}
              >
                {actionLoading === showRejectModal ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PendingApprovals
