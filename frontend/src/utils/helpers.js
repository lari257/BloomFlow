// Format date to readable string
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Format currency
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

// Get status badge color
export const getStatusColor = (status) => {
  const statusColors = {
    pending: '#FF9800',
    confirmed: '#2196F3',
    processing: '#9C27B0',
    completed: '#4CAF50',
    cancelled: '#F44336',
    available: '#4CAF50',
    reserved: '#FF9800',
    expired: '#F44336',
    sold: '#9C27B0'
  }
  return statusColors[status] || '#757575'
}

// Get user role display name
export const getRoleDisplayName = (role) => {
  const roleNames = {
    admin: 'Administrator',
    florar: 'Florist',
    client: 'Customer'
  }
  return roleNames[role] || role
}

// Check if user has role
export const hasRole = (userRoles, requiredRole) => {
  if (!userRoles || !Array.isArray(userRoles)) return false
  return userRoles.includes(requiredRole)
}

// Check if user has any of the roles
export const hasAnyRole = (userRoles, requiredRoles) => {
  if (!userRoles || !Array.isArray(userRoles)) return false
  if (!requiredRoles || !Array.isArray(requiredRoles)) return false
  return requiredRoles.some(role => userRoles.includes(role))
}

