import { API_ENDPOINTS, KEYCLOAK_CONFIG, STORAGE_KEYS } from '../utils/constants'

/**
 * Login user with username and password
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{access_token: string, user: object}>}
 */
export const login = async (username, password) => {
  const formData = new URLSearchParams()
  formData.append('grant_type', 'password')
  formData.append('client_id', KEYCLOAK_CONFIG.CLIENT_ID)
  formData.append('client_secret', KEYCLOAK_CONFIG.CLIENT_SECRET)
  formData.append('username', username)
  formData.append('password', password)

  const response = await fetch(API_ENDPOINTS.KEYCLOAK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error_description || errorData.error || 'Login failed')
  }

  const data = await response.json()
  
  // Store token
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token)
  
  // Decode token to get user info (simple base64 decode of JWT payload)
  try {
    const tokenParts = data.access_token.split('.')
    const payload = JSON.parse(atob(tokenParts[1]))
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(payload))
    
    return {
      access_token: data.access_token,
      user: payload
    }
  } catch (e) {
    console.error('Error decoding token:', e)
    return {
      access_token: data.access_token,
      user: null
    }
  }
}

/**
 * Get stored access token
 * @returns {string|null}
 */
export const getToken = () => {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
}

/**
 * Get stored user info
 * @returns {object|null}
 */
export const getUserInfo = () => {
  const userInfoStr = localStorage.getItem(STORAGE_KEYS.USER_INFO)
  if (!userInfoStr) return null
  try {
    return JSON.parse(userInfoStr)
  } catch (e) {
    return null
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  const token = getToken()
  if (!token) return false
  
  // Check if token is expired
  const userInfo = getUserInfo()
  if (userInfo && userInfo.exp) {
    const now = Math.floor(Date.now() / 1000)
    if (userInfo.exp < now) {
      logout()
      return false
    }
  }
  
  return true
}

/**
 * Get user roles from token
 * @returns {string[]}
 */
export const getUserRoles = () => {
  const userInfo = getUserInfo()
  if (!userInfo) return []
  
  // Try different role locations
  if (userInfo.roles && Array.isArray(userInfo.roles)) {
    return userInfo.roles
  }
  
  if (userInfo.realm_access && userInfo.realm_access.roles) {
    return userInfo.realm_access.roles
  }
  
  return []
}

/**
 * Logout user
 */
export const logout = () => {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.USER_INFO)
}

/**
 * Refresh token (if refresh token is available)
 * @returns {Promise<string|null>}
 */
export const refreshToken = async () => {
  // For now, we'll use password grant type
  // In production, you'd want to use refresh_token grant type
  // This would require storing the refresh_token
  // For simplicity, we'll require re-login when token expires
  logout()
  return null
}

