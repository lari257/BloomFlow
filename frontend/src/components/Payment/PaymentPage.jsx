import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getOrder } from '../../services/orders'
import { getFlowers } from '../../services/inventory'
import PaymentForm from './PaymentForm'
import { formatCurrency, formatDate } from '../../utils/helpers'
import '../../styles/components.css'

const PaymentPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [flowers, setFlowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadOrder()
  }, [id])

  const loadOrder = async () => {
    try {
      setLoading(true)
      const [orderResponse, flowersResponse] = await Promise.all([
        getOrder(id),
        getFlowers()
      ])
      setOrder(orderResponse.order)
      setFlowers(flowersResponse.flowers || [])

      // Check if order is in correct status for payment
      if (orderResponse.order.status !== 'pending_payment') {
        setError('This order is not pending payment')
      }
    } catch (err) {
      setError(err.message || 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  const getFlowerName = (flowerTypeId) => {
    const flower = flowers.find(f => f.id === flowerTypeId)
    return flower ? flower.name : `Flower #${flowerTypeId}`
  }

  const handlePaymentSuccess = () => {
    // Redirect to order detail page after successful payment
    navigate(`/orders/${id}`)
  }

  const handlePaymentError = (error) => {
    console.error('Payment error:', error)
    setError(error.message || 'Payment failed. Please try again.')
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <p style={{ color: '#c62828', margin: '0 0 20px 0' }}>{error}</p>
          <Link to="/orders" style={styles.backLink}>
            ← Back to Orders
          </Link>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <p style={{ color: '#c62828', margin: '0 0 20px 0' }}>Order not found</p>
          <Link to="/orders" style={styles.backLink}>
            ← Back to Orders
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Questrial&display=swap');
        
        * { box-sizing: border-box; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .btn:hover {
          transform: scale(1.03);
        }
        
        .btn:active {
          transform: scale(0.98);
        }
        
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #faf8f8;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #e8b4b8;
          border-radius: 4px;
        }
      `}</style>

      {/* Background decorative elements */}
      <div style={styles.bgDecor1}></div>
      <div style={styles.bgDecor2}></div>

      {/* Header */}
      <div style={styles.header}>
        <Link to={`/orders/${id}`} style={styles.backLink}>
          ← Back to Order
        </Link>
        <div>
          <h1 style={styles.title}>Complete Payment</h1>
          <p style={styles.subtitle}>Order #{order.id} • {formatDate(order.created_at)}</p>
        </div>
      </div>

      <div style={styles.content}>
        {/* Order Summary */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Order Summary</h3>
          
          {order.items && order.items.length > 0 && (
            <div style={styles.itemsTable}>
              {order.items.map((item, index) => (
                <div key={index} style={styles.itemRow}>
                  <span style={styles.itemName}>{getFlowerName(item.flower_type_id)}</span>
                  <span style={styles.itemQty}>×{item.quantity}</span>
                  <span style={styles.itemPrice}>{formatCurrency(item.unit_price)}</span>
                  <span style={styles.itemSubtotal}>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
              <div style={styles.totalRow}>
                <span style={styles.totalLabel}>Total</span>
                <span style={styles.totalAmount}>{formatCurrency(order.total_price)}</span>
              </div>
            </div>
          )}

          {order.notes && (
            <div style={styles.notesBox}>
              <strong>Notes:</strong> {order.notes}
            </div>
          )}
        </div>

        {/* Payment Form */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Payment Information</h3>
          
          {error && (
            <div style={styles.errorCard}>
              {error}
            </div>
          )}

          <PaymentForm
            orderId={order.id}
            amount={order.total_price}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: 'calc(100vh - 200px)',
    background: 'linear-gradient(180deg, #fdfbfb 0%, #f8f4f4 50%, #faf8f8 100%)',
    fontFamily: '"Questrial", sans-serif',
    color: '#1a1a1a',
    position: 'relative',
    overflow: 'hidden',
  },
  bgDecor1: {
    position: 'fixed',
    top: '-200px',
    right: '-200px',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(232,180,184,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  bgDecor2: {
    position: 'fixed',
    bottom: '-150px',
    left: '-150px',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(232,180,184,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: {
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },
  backLink: {
    display: 'inline-block',
    fontSize: '14px',
    color: '#d4919a',
    textDecoration: 'none',
    marginBottom: '16px',
    letterSpacing: '0.5px',
    transition: 'all 0.2s ease',
  },
  title: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '42px',
    fontWeight: '500',
    margin: '0 0 8px 0',
    color: '#1a1a1a',
    letterSpacing: '1px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
    margin: 0,
    letterSpacing: '0.5px',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
    gap: '24px',
  },
  section: {
    background: 'white',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  sectionTitle: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '24px',
    fontWeight: '500',
    margin: '0 0 24px 0',
    color: '#1a1a1a',
  },
  itemsTable: {
    background: '#faf8f8',
    borderRadius: '12px',
    padding: '4px',
    marginBottom: '20px',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    gap: '16px',
  },
  itemName: {
    flex: 1,
    fontSize: '15px',
    color: '#1a1a1a',
    fontWeight: '500',
  },
  itemQty: {
    fontSize: '14px',
    color: '#888',
    minWidth: '60px',
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: '14px',
    color: '#666',
    minWidth: '100px',
    textAlign: 'right',
  },
  itemSubtotal: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#1a1a1a',
    minWidth: '100px',
    textAlign: 'right',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 16px 16px',
    borderTop: '2px solid rgba(0,0,0,0.08)',
    marginTop: '4px',
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#666',
  },
  totalAmount: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  notesBox: {
    padding: '16px 20px',
    background: '#fef9f0',
    borderRadius: '12px',
    borderLeft: '3px solid #f5a623',
    fontSize: '15px',
    color: '#666',
    lineHeight: '1.6',
  },
  errorCard: {
    background: '#FFEBEE',
    color: '#c62828',
    padding: '16px 24px',
    borderRadius: '12px',
    marginBottom: '24px',
    border: '1px solid #ef9a9a',
  },
}

export default PaymentPage

