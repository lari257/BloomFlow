import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signup } from '../../services/users'
import '../../styles/components.css'

const Signup = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    firstName: '',
    lastName: '',
    requestedRole: 'client'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const response = await signup({
        username: formData.username,
        password: formData.password,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        requestedRole: formData.requestedRole
      })

      if (response.pending_approval) {
        setSuccess('Account created! Your florist request is pending admin approval. You can login as a client for now.')
      } else {
        setSuccess('Account created successfully! Redirecting to login...')
      }
      
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '500px' }}>
        <h1 className="login-title">🌸 Create Account</h1>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#666' }}>
          Join BloomFlow today
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                className="form-input"
                value={formData.firstName}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="John"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                className="form-input"
                value={formData.lastName}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              className="form-input"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Choose a username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="your@email.com"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-input"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Min 6 characters"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="form-input"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Repeat password"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Account Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <label 
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '1rem',
                  border: formData.requestedRole === 'client' ? '2px solid #4CAF50' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: formData.requestedRole === 'client' ? '#f0fff0' : '#fff'
                }}
              >
                <input
                  type="radio"
                  name="requestedRole"
                  value="client"
                  checked={formData.requestedRole === 'client'}
                  onChange={handleChange}
                  style={{ marginRight: '1rem', marginTop: '0.25rem' }}
                />
                <div>
                  <strong>🛒 Client</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.85rem' }}>
                    Browse and order beautiful bouquets
                  </p>
                </div>
              </label>

              <label 
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '1rem',
                  border: formData.requestedRole === 'florar' ? '2px solid #E91E63' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: formData.requestedRole === 'florar' ? '#fff0f5' : '#fff'
                }}
              >
                <input
                  type="radio"
                  name="requestedRole"
                  value="florar"
                  checked={formData.requestedRole === 'florar'}
                  onChange={handleChange}
                  style={{ marginRight: '1rem', marginTop: '0.25rem' }}
                />
                <div>
                  <strong>💐 Florist</strong>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.85rem' }}>
                    Create and manage bouquets
                    <span style={{ 
                      display: 'inline-block',
                      marginLeft: '0.5rem',
                      padding: '0.15rem 0.5rem',
                      backgroundColor: '#FFF3E0',
                      color: '#E65100',
                      borderRadius: '4px',
                      fontSize: '0.75rem'
                    }}>
                      ⏳ Requires approval
                    </span>
                  </p>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="form-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#E8F5E9', 
              color: '#2E7D32', 
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              ✅ {success}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <span style={{ color: '#666' }}>Already have an account? </span>
            <Link to="/login" style={{ color: '#E91E63', fontWeight: 'bold' }}>
              Login here
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Signup
