import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hasAnyRole } from '../../utils/helpers'

const Navbar = () => {
  const { user, logout, getRoles } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const roles = getRoles()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => {
    return location.pathname === path ? 'active' : ''
  }

  return (
    <nav className="layout-nav">
      <Link to="/dashboard" className="nav-logo">
        🌸 BloomFlow
      </Link>
      
      {user && (
        <ul className="nav-links">
          <li>
            <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>
              Dashboard
            </Link>
          </li>
          
          {hasAnyRole(roles, ['admin', 'florar']) && (
            <li>
              <Link to="/inventory" className={`nav-link ${isActive('/inventory')}`}>
                Inventory
              </Link>
            </li>
          )}
          
          <li>
            <Link to="/orders" className={`nav-link ${isActive('/orders')}`}>
              Orders
            </Link>
          </li>
          
{!hasAnyRole(roles, ['florar']) && (
          <li>
            <Link to="/bouquet" className={`nav-link ${isActive('/bouquet')}`}>
              Bouquet Builder
            </Link>
          </li>
          )}
          
          {hasAnyRole(roles, ['admin', 'florar']) && (
            <li>
              <Link to="/reports" className={`nav-link ${isActive('/reports')}`}>
                📊 Reports
              </Link>
            </li>
          )}
          
          {hasAnyRole(roles, ['admin']) && (
            <li>
              <Link to="/admin/approvals" className={`nav-link ${isActive('/admin/approvals')}`}>
                🔐 Approvals
              </Link>
            </li>
          )}
          
          <li>
            <Link to="/profile" className={`nav-link ${isActive('/profile')}`}>
              Profile
            </Link>
          </li>
          
          <li>
            <button onClick={handleLogout} className="btn btn-outline" style={{ marginLeft: '1rem' }}>
              Logout
            </button>
          </li>
        </ul>
      )}
    </nav>
  )
}

export default Navbar

