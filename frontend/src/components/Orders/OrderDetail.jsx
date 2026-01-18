import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getOrder, updateOrderStatus } from '../../services/orders'
import { getFlowers } from '../../services/inventory'
import { getUsers } from '../../services/users'
import { formatDate, formatCurrency, getStatusColor, hasRole, hasAnyRole } from '../../utils/helpers'
import { getUserInfo as getCurrentUserInfo } from '../../services/auth'
import '../../styles/components.css'

const OrderDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getRoles } = useAuth()
  const roles = getRoles()
  const [order, setOrder] = useState(null)
  const [flowers, setFlowers] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)

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

      // Load users if admin/florar
      if (hasAnyRole(roles, ['admin', 'florar'])) {
        try {
          const usersResponse = await getUsers()
          setUsers(usersResponse.users || [])
        } catch (err) {
          console.error('Error loading users:', err)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus) => {
    if (!confirm(`Are you sure you want to update order status to "${newStatus}"?`)) {
      return
    }

    try {
      setUpdating(true)
      await updateOrderStatus(id, newStatus)
      await loadOrder()
    } catch (err) {
      alert(err.message || 'Failed to update order status')
    } finally {
      setUpdating(false)
    }
  }

  const getFlowerName = (flowerTypeId) => {
    const flower = flowers.find(f => f.id === flowerTypeId)
    return flower ? flower.name : `Flower #${flowerTypeId}`
  }

  const getUserInfo = (userId) => {
    const user = users.find(u => u.id === userId)
    return user || { name: `User #${userId}`, email: '' }
  }

  // Map status: backend uses 'processing', design uses 'ready'
  const mapStatus = (status) => {
    if (status === 'processing') return 'ready'
    return status
  }

  const statusConfig = {
    pending_payment: { label: 'Payment Pending', color: '#f5a623', bg: '#fef7e8' },
    pending: { label: 'Pending', color: '#f5a623', bg: '#fef7e8' },
    confirmed: { label: 'Confirmed', color: '#4a90d9', bg: '#e8f2fc' },
    ready: { label: 'Ready', color: '#7b68ee', bg: '#f0effe' },
    processing: { label: 'Ready', color: '#7b68ee', bg: '#f0effe' },
    completed: { label: 'Completed', color: '#50c878', bg: '#e8f8ee' },
    cancelled: { label: 'Cancelled', color: '#999', bg: '#f5f5f5' },
  }

  const paymentStatusConfig = {
    pending: { label: 'Payment Pending', color: '#f5a623', bg: '#fef7e8' },
    processing: { label: 'Processing Payment', color: '#4a90d9', bg: '#e8f2fc' },
    succeeded: { label: 'Payment Successful', color: '#50c878', bg: '#e8f8ee' },
    failed: { label: 'Payment Failed', color: '#c62828', bg: '#FFEBEE' },
    refunded: { label: 'Refunded', color: '#999', bg: '#f5f5f5' },
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <p style={{ color: '#c62828', margin: '0 0 20px 0' }}>{error || 'Order not found'}</p>
          <Link to="/orders" style={styles.backLink}>
            ← Back to Orders
          </Link>
        </div>
      </div>
    )
  }

  const statusOptions = ['pending_payment', 'pending', 'confirmed', 'processing', 'completed', 'cancelled']
  const isAdmin = hasRole(roles, 'admin')
  const isFlorar = hasRole(roles, 'florar')
  const isClient = hasRole(roles, 'client')
  const canEdit = isAdmin || isFlorar
  const user = getUserInfo(order.user_id)
  const displayStatus = mapStatus(order.status)
  const statusInfo = statusConfig[displayStatus] || statusConfig[order.status] || statusConfig.pending
  const paymentStatusInfo = paymentStatusConfig[order.payment_status] || paymentStatusConfig.pending
  const needsPayment = order.status === 'pending_payment' || (order.payment_status && order.payment_status !== 'succeeded')

  // Determine if the current user can cancel this order
  const currentUser = getCurrentUserInfo()
  const currentUserId = currentUser && currentUser.id ? String(currentUser.id) : null
  const canCancel = (
    // Admin or florar can cancel any unpaid order
    (canEdit && order.payment_status === 'pending' && order.status !== 'cancelled') ||
    // Client can cancel their own unpaid order
    (isClient && order.payment_status === 'pending' && order.status !== 'cancelled' && order.user_id && currentUserId && String(order.user_id) === currentUserId)
  )

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
        <Link to="/orders" style={styles.backLink}>
          ← Back to Orders
        </Link>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Order #{order.id}</h1>
          <span style={{
            ...styles.statusBadge,
            background: statusInfo.bg,
            color: statusInfo.color,
          }}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Customer Section */}
        {canEdit && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Customer</h3>
            <div style={styles.customerCard}>
              <div style={styles.customerAvatar}>
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div style={styles.customerDetails}>
                <span style={styles.customerName}>{user.name}</span>
                {user.email && (
                  <span style={styles.customerEmail}>{user.email}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Items Section */}
        {order.items && order.items.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Items</h3>
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
          </div>
        )}

        {/* Order Info */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Order Information</h3>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Created At</span>
              <span style={styles.infoValue}>{formatDate(order.created_at)}</span>
            </div>
            {order.user_id && canEdit && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>User ID</span>
                <span style={styles.infoValue}>{order.user_id}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Status */}
        {order.payment_status && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Payment Status</h3>
            <div style={styles.paymentInfo}>
              <span style={{
                ...styles.paymentBadge,
                background: paymentStatusInfo.bg,
                color: paymentStatusInfo.color,
              }}>
                {paymentStatusInfo.label}
              </span>
              {needsPayment && !canEdit && (
                <button
                  onClick={() => navigate(`/orders/${order.id}/payment`)}
                  style={styles.payButton}
                  className="btn"
                >
                  Pay Now
                </button>
              )}
              {order.stripe_payment_intent_id && (
                <div style={styles.paymentDetails}>
                  <span style={styles.paymentLabel}>Payment Intent:</span>
                  <span style={styles.paymentValue}>{order.stripe_payment_intent_id}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Notes</h3>
            <div style={styles.notesBox}>
              {order.notes}
            </div>
          </div>
        )}

        {/* Status Actions */}
        {(canEdit || canCancel) && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Update Status</h3>
            {canEdit && (
              <div style={styles.statusButtons}>
                {statusOptions.map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(status)}
                    disabled={updating || order.status === status}
                    style={{
                      ...styles.statusBtn,
                      ...(order.status === status ? {
                        background: statusConfig[mapStatus(status)].color,
                        color: 'white',
                        borderColor: statusConfig[mapStatus(status)].color,
                      } : {})
                    }}
                    className="btn"
                  >
                    {statusConfig[mapStatus(status)].label}
                  </button>
                ))}
              </div>
            )}
            {canCancel && (
              <button
                onClick={() => handleStatusUpdate('cancelled')}
                disabled={updating}
                style={styles.cancelBtn}
                className="btn"
              >
                Cancel Order
              </button>
            )}
          </div>
        )}
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
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '42px',
    fontWeight: '500',
    margin: 0,
    color: '#1a1a1a',
    letterSpacing: '1px',
  },
  statusBadge: {
    fontSize: '14px',
    padding: '8px 16px',
    borderRadius: '20px',
    fontWeight: '500',
    letterSpacing: '0.3px',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  section: {
    background: 'white',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    marginBottom: '24px',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  sectionTitle: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '24px',
    fontWeight: '500',
    margin: '0 0 24px 0',
    color: '#1a1a1a',
  },
  customerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '20px',
    background: '#faf8f8',
    borderRadius: '12px',
  },
  customerAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #e8b4b8 0%, #d4919a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '24px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(212,145,154,0.3)',
  },
  customerDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  customerName: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  customerEmail: {
    fontSize: '14px',
    color: '#888',
  },
  itemsTable: {
    background: '#faf8f8',
    borderRadius: '12px',
    padding: '4px',
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
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  infoLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#999',
  },
  infoValue: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  paymentInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  paymentBadge: {
    fontSize: '14px',
    padding: '8px 16px',
    borderRadius: '20px',
    fontWeight: '500',
    letterSpacing: '0.3px',
    alignSelf: 'flex-start',
  },
  payButton: {
    padding: '12px 24px',
    borderRadius: '10px',
    fontSize: '14px',
    fontFamily: '"Questrial", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    background: '#1a1a1a',
    color: 'white',
    letterSpacing: '0.5px',
    alignSelf: 'flex-start',
  },
  paymentDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    background: '#faf8f8',
    borderRadius: '8px',
  },
  paymentLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#999',
  },
  paymentValue: {
    fontSize: '13px',
    fontFamily: 'monospace',
    color: '#666',
    wordBreak: 'break-all',
  },
  notesBox: {
    padding: '16px 20px',
    background: '#fef9f0',
    borderRadius: '12px',
    borderLeft: '3px solid #f5a623',
    fontSize: '15px',
    color: '#666',
    lineHeight: '1.6',
    fontStyle: 'italic',
  },
  statusButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
  },
  statusBtn: {
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: '"Questrial", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid rgba(0,0,0,0.1)',
    background: 'white',
    color: '#666',
    letterSpacing: '0.5px',
  },
  cancelBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: '"Questrial", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    background: '#fee',
    color: '#c66',
    letterSpacing: '0.5px',
  },
  errorCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
  },
}

export default OrderDetail
