import ApiClient from './api'
import { API_ENDPOINTS } from '../utils/constants'

const client = new ApiClient(API_ENDPOINTS.ORDER_SERVICE)

/**
 * Create payment intent for an order
 */
export const createPaymentIntent = async (orderId) => {
  return client.post(`/orders/${orderId}/create-payment-intent`)
}

/**
 * Confirm payment after processing
 */
export const confirmPayment = async (orderId, paymentIntentId) => {
  return client.post(`/orders/${orderId}/confirm-payment`, {
    payment_intent_id: paymentIntentId
  })
}


