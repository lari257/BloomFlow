import ApiClient from './api'
import { API_ENDPOINTS } from '../utils/constants'

const client = new ApiClient(API_ENDPOINTS.USER_SERVICE)

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

