import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { registerWithRole } from '../../services/users'
import '../../styles/components.css'

const Register = () => {
  const [selectedRole, setSelectedRole] = useState('client')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await registerWithRole(selectedRole)
      
      if (response.pending_approval) {
        setSuccess('Your florar account request has been submitted and is pending admin approval. You will be notified once approved.')
      } else {
        setSuccess('Registration successful! Redirecting to dashboard...')
        setTimeout(() => navigate('/dashboard'), 2000)
      }
    } catch (err) {
      if (err.message?.includes('already registered')) {
        setSuccess('You are already registered. Redirecting to dashboard...')
        setTimeout(() => navigate('/dashboard'), 2000)
      } else {
        setError(err.message || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '500px' }}>
        <h1 className="login-title">Complete Registration</h1>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
          Welcome! Please choose your account type to continue.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Account Type</label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <label 
                className={`role-option ${selectedRole === 'client' ? 'selected' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '1rem',
                  border: selectedRole === 'client' ? '2px solid #4CAF50' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedRole === 'client' ? '#f0fff0' : '#fff'
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value="client"
                  checked={selectedRole === 'client'}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  style={{ marginRight: '1rem', marginTop: '0.25rem' }}
                />
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>🛒 Client</strong>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                    Browse and order beautiful bouquets. Perfect for customers who want to buy flowers.
                  </p>
                </div>
              </label>

              <label 
                className={`role-option ${selectedRole === 'florar' ? 'selected' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '1rem',
                  border: selectedRole === 'florar' ? '2px solid #E91E63' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedRole === 'florar' ? '#fff0f5' : '#fff'
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value="florar"
                  checked={selectedRole === 'florar'}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  style={{ marginRight: '1rem', marginTop: '0.25rem' }}
                />
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>💐 Florist</strong>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                    Create and manage flower inventory, process orders, and generate reports.
                    <br />
                    <span style={{ color: '#E91E63', fontStyle: 'italic' }}>
                      ⚠️ Requires admin approval
                    </span>
                  </p>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="form-error" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#ffebee', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ 
              marginBottom: '1rem', 
              padding: '1rem', 
              backgroundColor: '#e8f5e9', 
              borderRadius: '4px',
              color: '#2e7d32',
              border: '1px solid #a5d6a7'
            }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading || success}
          >
            {loading ? 'Submitting...' : selectedRole === 'florar' ? 'Request Florist Account' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Register
