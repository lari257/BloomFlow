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
          
          <li>
            <Link to="/bouquet" className={`nav-link ${isActive('/bouquet')}`}>
              Bouquet Builder
            </Link>
          </li>
          
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

