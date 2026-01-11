import ApiClient from './api'
import { API_ENDPOINTS } from '../utils/constants'

const client = new ApiClient(API_ENDPOINTS.ORDER_SERVICE)

/**
 * Get all orders (admin sees all, client sees own)
 */
export const getOrders = async () => {
  return client.get('/orders')
}

/**
 * Get current user's orders
 */
export const getMyOrders = async () => {
  return client.get('/orders/me')
}

/**
 * Get order by ID
 */
export const getOrder = async (orderId) => {
  return client.get(`/orders/${orderId}`)
}

/**
 * Create order
 */
export const createOrder = async (orderData) => {
  return client.post('/orders', orderData)
}

/**
 * Update order status (admin only)
 */
export const updateOrderStatus = async (orderId, status) => {
  return client.put(`/orders/${orderId}/status`, { status })
}

/**
 * Get orders for a user (admin only)
 */
export const getUserOrders = async (userId) => {
  return client.get(`/orders/user/${userId}`)
}

