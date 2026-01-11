import ApiClient from './api'
import { API_ENDPOINTS } from '../utils/constants'

const client = new ApiClient(API_ENDPOINTS.BOUQUET_SERVICE)

/**
 * Get bouquet preview configurations
 */
export const getBouquetPreview = async (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.budget) params.append('budget', filters.budget)
  if (filters.colors) params.append('colors', filters.colors)
  if (filters.season) params.append('season', filters.season)
  if (filters.style) params.append('style', filters.style)
  
  const queryString = params.toString()
  const endpoint = queryString ? `/bouquet/preview?${queryString}` : '/bouquet/preview'
  return client.get(endpoint)
}

/**
 * Validate bouquet configuration
 */
export const validateBouquet = async (configuration) => {
  return client.post('/bouquet/validate', configuration)
}

/**
 * Get bouquet composition rules
 */
export const getBouquetRules = async () => {
  return client.get('/bouquet/rules')
}

