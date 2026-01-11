import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getCurrentUser } from '../../services/users'
import { getRoleDisplayName } from '../../utils/helpers'
import '../../styles/components.css'

const Profile = () => {
  const { user: tokenUser, getRoles } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const roles = getRoles()

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const response = await getCurrentUser()
      setUser(response.user)
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  const displayUser = user || tokenUser
  const displayName = displayUser?.name || displayUser?.preferred_username || displayUser?.email?.split('@')[0] || 'User'
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Questrial&display=swap');
        
        * { box-sizing: border-box; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .profile-card {
          animation: fadeIn 0.6s ease-out forwards;
          opacity: 0;
        }
        
        .info-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }
        
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #faf8f8;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #e8b4b8;
          border-radius: 4px;
        }
      `}</style>

      {/* Background decorative elements */}
      <div style={styles.bgDecor1}></div>
      <div style={styles.bgDecor2}></div>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Profile</h1>
          <p style={styles.subtitle}>Your account information</p>
        </div>
      </div>

      {/* Profile Card */}
      <div style={styles.profileCard} className="profile-card">
        <div style={styles.avatarSection}>
          <div style={styles.avatar}>
            {initials}
          </div>
          <div style={styles.nameSection}>
            <h2 style={styles.name}>{displayName}</h2>
            <p style={styles.email}>{displayUser?.email || tokenUser?.email || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div style={styles.infoGrid}>
        <div style={styles.infoCard} className="info-card">
          <div style={styles.infoIcon}>✉</div>
          <div style={styles.infoContent}>
            <span style={styles.infoLabel}>Email</span>
            <span style={styles.infoValue}>{displayUser?.email || tokenUser?.email || 'N/A'}</span>
          </div>
        </div>

        <div style={styles.infoCard} className="info-card">
          <div style={styles.infoIcon}>👤</div>
          <div style={styles.infoContent}>
            <span style={styles.infoLabel}>Username</span>
            <span style={styles.infoValue}>{displayUser?.name || tokenUser?.preferred_username || 'N/A'}</span>
          </div>
        </div>

        {displayUser?.role && (
          <div style={styles.infoCard} className="info-card">
            <div style={styles.infoIcon}>🎭</div>
            <div style={styles.infoContent}>
              <span style={styles.infoLabel}>Primary Role</span>
              <span style={styles.infoValue}>
                <span style={{
                  ...styles.roleBadge,
                  background: '#fdf2f3',
                  color: '#d4919a',
                }}>
                  {getRoleDisplayName(displayUser.role)}
                </span>
              </span>
            </div>
          </div>
        )}

        {displayUser?.id && (
          <div style={styles.infoCard} className="info-card">
            <div style={styles.infoIcon}>#</div>
            <div style={styles.infoContent}>
              <span style={styles.infoLabel}>User ID</span>
              <span style={{...styles.infoValue, fontFamily: 'monospace', fontSize: '14px'}}>{displayUser.id}</span>
            </div>
          </div>
        )}
      </div>

      {/* Roles Section */}
      {roles.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Roles</h3>
          <div style={styles.rolesContainer}>
            {roles.map((role, index) => (
              <span
                key={role}
                style={{
                  ...styles.roleBadge,
                  background: '#e8f2fc',
                  color: '#4a90d9',
                  animationDelay: `${index * 0.1}s`,
                }}
              >
                {getRoleDisplayName(role)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    minHeight: 'calc(100vh - 200px)',
    background: 'linear-gradient(180deg, #fdfbfb 0%, #f8f4f4 50%, #faf8f8 100%)',
    fontFamily: '"Questrial", sans-serif',
    color: '#1a1a1a',
    position: 'relative',
    overflow: 'hidden',
  },
  bgDecor1: {
    position: 'fixed',
    top: '-200px',
    right: '-200px',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(232,180,184,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  bgDecor2: {
    position: 'fixed',
    bottom: '-150px',
    left: '-150px',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(232,180,184,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: {
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },
  title: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '42px',
    fontWeight: '500',
    margin: '0 0 8px 0',
    color: '#1a1a1a',
    letterSpacing: '1px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
    margin: 0,
    letterSpacing: '0.5px',
  },
  profileCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    marginBottom: '32px',
    border: '1px solid rgba(0,0,0,0.04)',
    position: 'relative',
    zIndex: 1,
  },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  avatar: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #e8b4b8 0%, #d4919a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '36px',
    fontWeight: '500',
    boxShadow: '0 8px 24px rgba(212,145,154,0.3)',
  },
  nameSection: {
    flex: 1,
  },
  name: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '32px',
    fontWeight: '500',
    margin: '0 0 8px 0',
    color: '#1a1a1a',
  },
  email: {
    fontSize: '16px',
    color: '#888',
    margin: 0,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },
  infoCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
    transition: 'all 0.3s ease',
    border: '1px solid rgba(0,0,0,0.04)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  infoIcon: {
    fontSize: '28px',
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #fdf2f3 0%, #fce8ea 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  infoLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#999',
  },
  infoValue: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  roleBadge: {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    letterSpacing: '0.3px',
  },
  section: {
    background: 'white',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.04)',
    position: 'relative',
    zIndex: 1,
  },
  sectionTitle: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '24px',
    fontWeight: '500',
    margin: '0 0 20px 0',
    color: '#1a1a1a',
  },
  rolesContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
}

export default Profile
