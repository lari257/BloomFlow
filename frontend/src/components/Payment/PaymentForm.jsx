import React, { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { createPaymentIntent, confirmPayment } from '../../services/payments'
import { formatCurrency } from '../../utils/helpers'

// Initialize Stripe - you'll need to set this in your environment or constants
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder')

const PaymentFormInner = ({ orderId, amount, onSuccess, onError }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [paymentIntentId, setPaymentIntentId] = useState('')
  const [initialized, setInitialized] = useState(false)

  React.useEffect(() => {
    // Prevent duplicate calls (React StrictMode runs effects twice)
    if (initialized || clientSecret) {
      return
    }
    
    let isCancelled = false
    
    // Create payment intent when component mounts
    const initializePayment = async () => {
      try {
        setProcessing(true)
        setInitialized(true)
        const response = await createPaymentIntent(orderId)
        if (!isCancelled) {
          setClientSecret(response.client_secret)
          setPaymentIntentId(response.payment_intent_id)
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Failed to initialize payment')
          onError?.(err)
          setInitialized(false) // Allow retry on error
        }
      } finally {
        if (!isCancelled) {
          setProcessing(false)
        }
      }
    }

    if (orderId) {
      initializePayment()
    }
    
    return () => {
      isCancelled = true
    }
  }, [orderId]) // Removed onError from deps to prevent re-runs

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setProcessing(true)
    setError('')

    const cardElement = elements.getElement(CardElement)

    try {
      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
          }
        }
      )

      if (stripeError) {
        setError(stripeError.message || 'Payment failed')
        onError?.(stripeError)
        setProcessing(false)
        return
      }

      if (paymentIntent.status === 'succeeded') {
        // Confirm payment with backend
        try {
          await confirmPayment(orderId, paymentIntent.id)
          onSuccess?.(paymentIntent)
        } catch (err) {
          setError(err.message || 'Failed to confirm payment')
          onError?.(err)
        }
      } else {
        setError(`Payment status: ${paymentIntent.status}`)
        onError?.(new Error(`Payment status: ${paymentIntent.status}`))
      }
    } catch (err) {
      setError(err.message || 'An error occurred during payment')
      onError?.(err)
    } finally {
      setProcessing(false)
    }
  }

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1a1a1a',
        fontFamily: '"Questrial", sans-serif',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#c62828',
        iconColor: '#c62828',
      },
    },
  }

  if (!clientSecret) {
    return (
      <div style={styles.loadingContainer}>
        <div className="spinner"></div>
        <p style={styles.loadingText}>Initializing payment...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.amountSection}>
        <span style={styles.amountLabel}>Total Amount</span>
        <span style={styles.amountValue}>{formatCurrency(amount)}</span>
      </div>

      <div style={styles.cardSection}>
        <label style={styles.label}>Card Details</label>
        <div style={styles.cardElementContainer}>
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {error && (
        <div style={styles.errorCard}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        style={{
          ...styles.submitButton,
          ...(processing || !stripe ? styles.submitButtonDisabled : {})
        }}
        className="btn"
      >
        {processing ? 'Processing...' : `Pay ${formatCurrency(amount)}`}
      </button>

      <p style={styles.securityNote}>
        🔒 Your payment information is secure and encrypted
      </p>
    </form>
  )
}

const PaymentForm = ({ orderId, amount, onSuccess, onError }) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormInner
        orderId={orderId}
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  )
}

const styles = {
  form: {
    width: '100%',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '16px',
  },
  loadingText: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  amountSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    background: '#faf8f8',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  amountLabel: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  amountValue: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  cardSection: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    color: '#888',
    marginBottom: '8px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  cardElementContainer: {
    padding: '14px 16px',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '10px',
    background: 'white',
  },
  errorCard: {
    background: '#FFEBEE',
    color: '#c62828',
    padding: '16px 24px',
    borderRadius: '12px',
    marginBottom: '24px',
    border: '1px solid #ef9a9a',
  },
  submitButton: {
    width: '100%',
    padding: '14px 28px',
    borderRadius: '10px',
    fontSize: '14px',
    fontFamily: '"Questrial", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    background: '#1a1a1a',
    color: 'white',
    letterSpacing: '0.5px',
    marginBottom: '16px',
  },
  submitButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  securityNote: {
    fontSize: '12px',
    color: '#888',
    textAlign: 'center',
    margin: 0,
  },
}

export default PaymentForm


