import ApiClient from './api'
import { API_ENDPOINTS } from '../utils/constants'

const client = new ApiClient(API_ENDPOINTS.USER_SERVICE)

/**
 * Signup - create a new user account (no auth required)
 */
export const signup = async (userData) => {
  const response = await fetch(`${API_ENDPOINTS.USER_SERVICE}/users/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'Signup failed')
  }
  
  return data
}

/**
 * Get current user information
 */
export const getCurrentUser = async () => {
  return client.get('/users/me')
}

/**
 * Get all users (admin only)
 */
export const getUsers = async () => {
  return client.get('/users')
}

/**
 * Get user by ID
 */
export const getUser = async (userId) => {
  return client.get(`/users/${userId}`)
}

/**
 * Sync current user with Keycloak
 */
export const syncUser = async () => {
  return client.post('/users/sync')
}

/**
 * Update user role (admin only)
 */
export const updateUserRole = async (userId, role) => {
  return client.put(`/users/${userId}/role`, { role })
}

/**
 * Get all roles
 */
export const getRoles = async () => {
  return client.get('/roles')
}

/**
 * Get current user's notification preferences
 */
export const getNotificationPreferences = async () => {
  return client.get('/users/me/notifications')
}

/**
 * Update current user's notification preferences
 */
export const updateNotificationPreferences = async (preferences) => {
  return client.put('/users/me/notifications', preferences)
}

/**
 * Register user with optional role request
 * @param {string} requestedRole - 'client' or 'florar'
 */
export const registerWithRole = async (requestedRole = 'client') => {
  return client.post('/users/register', { requested_role: requestedRole })
}

/**
 * Get pending florar approvals (admin only)
 */
export const getPendingApprovals = async () => {
  return client.get('/users/pending-approvals')
}

/**
 * Approve a florar request (admin only)
 */
export const approveFlorar = async (userId) => {
  return client.post(`/users/${userId}/approve`)
}

/**
 * Reject a florar request (admin only)
 */
export const rejectFlorar = async (userId, reason = '') => {
  return client.post(`/users/${userId}/reject`, { reason })
}

