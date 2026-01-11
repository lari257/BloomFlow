import ApiClient from './api'
import { API_ENDPOINTS } from '../utils/constants'

const client = new ApiClient(API_ENDPOINTS.INVENTORY_SERVICE)

/**
 * Get all flowers
 */
export const getFlowers = async () => {
  return client.get('/flowers')
}

/**
 * Get flower by ID
 */
export const getFlower = async (flowerId) => {
  return client.get(`/flowers/${flowerId}`)
}

/**
 * Create flower (admin/florar)
 */
export const createFlower = async (flowerData) => {
  return client.post('/flowers', flowerData)
}

/**
 * Update flower (admin/florar)
 */
export const updateFlower = async (flowerId, flowerData) => {
  return client.put(`/flowers/${flowerId}`, flowerData)
}

/**
 * Delete flower (admin only)
 */
export const deleteFlower = async (flowerId) => {
  return client.delete(`/flowers/${flowerId}`)
}

/**
 * Get all lots
 */
export const getLots = async (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.status) params.append('status', filters.status)
  if (filters.flower_type_id) params.append('flower_type_id', filters.flower_type_id)
  
  const queryString = params.toString()
  const endpoint = queryString ? `/lots?${queryString}` : '/lots'
  return client.get(endpoint)
}

/**
 * Get lot by ID
 */
export const getLot = async (lotId) => {
  return client.get(`/lots/${lotId}`)
}

/**
 * Create lot (admin/florar)
 */
export const createLot = async (lotData) => {
  return client.post('/lots', lotData)
}

/**
 * Update lot (admin/florar)
 */
export const updateLot = async (lotId, lotData) => {
  return client.put(`/lots/${lotId}`, lotData)
}

/**
 * Update lot quantity (admin/florar)
 */
export const updateLotQuantity = async (lotId, quantity) => {
  return client.patch(`/lots/${lotId}/quantity`, { quantity })
}

/**
 * Delete lot (admin only)
 */
export const deleteLot = async (lotId) => {
  return client.delete(`/lots/${lotId}`)
}

/**
 * Get expiring lots
 */
export const getExpiringLots = async (days = 7) => {
  return client.get(`/lots/expiring?days=${days}`)
}

/**
 * Get inventory summary
 */
export const getInventorySummary = async () => {
  return client.get('/inventory/summary')
}

/**
 * Check availability
 */
export const checkAvailability = async (items) => {
  // items is array of {flower_type_id, quantity}
  const params = new URLSearchParams()
  items.forEach(item => {
    params.append('flower_type_id', item.flower_type_id)
    params.append('quantity', item.quantity)
  })
  
  return client.get(`/inventory/available?${params.toString()}`)
}

