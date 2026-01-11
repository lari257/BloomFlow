import React, { createContext, useContext, useState, useEffect } from 'react'
import * as authService from '../services/auth'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const storedToken = authService.getToken()
    const storedUser = authService.getUserInfo()
    
    if (storedToken && authService.isAuthenticated()) {
      setToken(storedToken)
      setUser(storedUser)
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    try {
      const result = await authService.login(username, password)
      setToken(result.access_token)
      setUser(result.user)
      return result
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    authService.logout()
    setToken(null)
    setUser(null)
  }

  const getRoles = () => {
    return authService.getUserRoles()
  }

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    getRoles,
    isAuthenticated: !!token && authService.isAuthenticated()
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

