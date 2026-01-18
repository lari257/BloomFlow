import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getOrders, updateOrderStatus } from '../../services/orders'
import { getFlowers } from '../../services/inventory'
import { getUsers } from '../../services/users'
import { formatDate, formatCurrency, hasRole, hasAnyRole } from '../../utils/helpers'
import '../../styles/components.css'

const OrderList = () => {
  const navigate = useNavigate()
  const { getRoles } = useAuth()
  const roles = getRoles()
  const [orders, setOrders] = useState([])
  const [flowers, setFlowers] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const isAdmin = hasRole(roles, 'admin')
  const canEdit = hasAnyRole(roles, ['admin', 'florar'])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [ordersResponse, flowersResponse] = await Promise.all([
        getOrders(),
        getFlowers()
      ])

      setOrders(ordersResponse.orders || [])
      setFlowers(flowersResponse.flowers || [])

      // Load users if admin/florar
      if (canEdit) {
        try {
          const usersResponse = await getUsers()
          setUsers(usersResponse.users || [])
        } catch (err) {
          console.error('Error loading users:', err)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      setUpdatingStatus(true)
      await updateOrderStatus(orderId, newStatus)
      await loadData()
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus })
      }
    } catch (err) {
      alert(err.message || 'Failed to update order status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // Map status for UI
  const mapStatus = (status) => {
    if (status === 'pending_payment') return 'pending'
    return status
  }

  const statusConfig = {
    pending: { label: 'Pending', color: '#f5a623', bg: '#fef7e8' },
    confirmed: { label: 'Confirmed', color: '#4a90d9', bg: '#e8f2fc' },
    completed: { label: 'Completed', color: '#50c878', bg: '#e8f8ee' },
    cancelled: { label: 'Cancelled', color: '#999', bg: '#f5f5f5' },
  }

  // Get flower name by ID
  const getFlowerName = (flowerTypeId) => {
    const flower = flowers.find(f => f.id === flowerTypeId)
    return flower ? flower.name : `Flower #${flowerTypeId}`
  }

  // Get user info by ID
  const getUserInfo = (userId) => {
    const user = users.find(u => u.id === userId)
    return user || { name: `User #${userId}`, email: '' }
  }

  // Format order for display
  const formatOrder = (order) => {
    const user = getUserInfo(order.user_id)
    const displayStatus = mapStatus(order.status)
    const statusInfo = statusConfig[displayStatus] || statusConfig[order.status] || statusConfig.pending
    
    return {
      ...order,
      displayStatus,
      statusInfo,
      customerName: user.name || user.email || `User #${order.user_id}`,
      customerEmail: user.email || '',
      items: (order.items || []).map(item => ({
        ...item,
        name: getFlowerName(item.flower_type_id),
        price: item.unit_price,
      })),
      createdDate: order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : '',
      createdTime: order.created_at ? new Date(order.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
    }
  }

  const formattedOrders = orders.map(formatOrder)

  const filteredOrders = formattedOrders.filter(order => {
    let matchesStatus = false;
    if (filterStatus === 'all') {
      matchesStatus = true;
    } else if (filterStatus === 'pending') {
      matchesStatus = order.status === 'pending' || order.status === 'pending_payment';
    } else {
      matchesStatus = order.displayStatus === filterStatus;
    }
    const matchesSearch = 
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `ORD-${order.id}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesStatus && matchesSearch
  })

  const getOrderTotal = (items) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
  }

  // Calculate stats
  const today = new Date().toISOString().split('T')[0]
  const todayOrders = formattedOrders.filter(o => o.createdDate === today && o.displayStatus !== 'cancelled').length
  const pendingOrders = formattedOrders.filter(o => o.status === 'pending' || o.status === 'pending_payment').length
  const todayRevenue = formattedOrders
    .filter(o => o.createdDate === today && o.displayStatus !== 'cancelled')
    .reduce((sum, o) => sum + getOrderTotal(o.items), 0)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner"></div>
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
        
        .order-row {
          animation: fadeIn 0.5s ease-out forwards;
          opacity: 0;
        }
        
        .order-row:hover {
          background: linear-gradient(90deg, rgba(232,180,184,0.08) 0%, transparent 100%);
        }
        
        .stat-card:hover {
          transform: translateY(-4px);
        }
        
        .btn:hover {
          transform: scale(1.03);
        }
        
        .btn:active {
          transform: scale(0.98);
        }
        
        .filter-btn:hover {
          background: #f5f0f0;
        }
        
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: #e8b4b8;
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

      {/* Stats Row */}
      <div style={styles.statsRow}>
        <div style={styles.statCard} className="stat-card">
          <div style={styles.statIcon}>❋</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{todayOrders}</span>
            <span style={styles.statLabel}>Today's Orders</span>
          </div>
        </div>
        <div style={{...styles.statCard, ...(pendingOrders > 0 ? styles.statCardHighlight : {})}} className="stat-card">
          <div style={styles.statIcon}>⧖</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{pendingOrders}</span>
            <span style={styles.statLabel}>Pending</span>
          </div>
        </div>
        {/* Removed Ready for Pickup stat */}
        <div style={styles.statCard} className="stat-card">
          <div style={styles.statIcon}>◈</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{formatCurrency(todayRevenue)}</span>
            <span style={styles.statLabel}>Today's Revenue</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.filterGroup}>
            {['all', 'pending', 'confirmed', 'completed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  ...styles.filterBtn,
                  ...(filterStatus === status ? styles.filterBtnActive : {})
                }}
                className="filter-btn"
              >
                {status === 'all' ? 'All Orders' : statusConfig[status]?.label}
                {status !== 'all' && (
                  <span style={{
                    ...styles.filterCount,
                    background: filterStatus === status ? 'rgba(255,255,255,0.3)' : statusConfig[status]?.bg,
                    color: filterStatus === status ? 'white' : statusConfig[status]?.color,
                  }}>
                    {status === 'pending'
                      ? formattedOrders.filter(o => o.status === 'pending' || o.status === 'pending_payment').length
                      : formattedOrders.filter(o => mapStatus(o.status) === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div style={styles.toolbarRight}>
            <div style={styles.searchWrapper}>
              <span style={styles.searchIcon}>⌕</span>
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
{!hasRole(roles, 'florar') && (
            <button
              onClick={() => navigate('/orders/new')}
              style={{...styles.btn, ...styles.btnPrimary}}
              className="btn"
            >
              + New Order
            </button>
            )}
          </div>
        </div>

        {error && (
          <div style={styles.errorCard}>
            {error}
          </div>
        )}

        {/* Orders Table */}
        <div style={styles.ordersContainer}>
          <div style={styles.tableHeader}>
            <span style={{...styles.tableHeaderCell, width: '100px'}}>Order ID</span>
            <span style={{...styles.tableHeaderCell, flex: 1}}>Customer</span>
            <span style={{...styles.tableHeaderCell, width: '180px'}}>Items</span>
            <span style={{...styles.tableHeaderCell, width: '100px'}}>Total</span>
            <span style={{...styles.tableHeaderCell, width: '120px'}}>Date & Time</span>
            <span style={{...styles.tableHeaderCell, width: '120px'}}>Status</span>
          </div>

          <div style={styles.tableBody}>
            {filteredOrders.map((order, index) => (
              <div
                key={order.id}
                className="order-row"
                style={{
                  ...styles.orderRow,
                  animationDelay: `${index * 0.05}s`,
                  ...(selectedOrder?.id === order.id ? styles.orderRowSelected : {})
                }}
                onClick={() => setSelectedOrder(order)}
              >
                <span style={{...styles.orderCell, width: '100px'}}>
                  <span style={styles.orderId}>#{order.id}</span>
                </span>
                <span style={{...styles.orderCell, flex: 1}}>
                  <div style={styles.customerInfo}>
                    <span style={styles.customerName}>{order.customerName}</span>
                    {order.customerEmail && (
                      <span style={styles.customerEmail}>{order.customerEmail}</span>
                    )}
                  </div>
                </span>
                <span style={{...styles.orderCell, width: '180px'}}>
                  <div style={styles.itemsList}>
                    {order.items.slice(0, 2).map((item, i) => (
                      <span key={i} style={styles.itemPill}>
                        {item.quantity}× {item.name.split(' ')[0]}
                      </span>
                    ))}
                    {order.items.length > 2 && (
                      <span style={styles.moreItems}>+{order.items.length - 2} more</span>
                    )}
                  </div>
                </span>
                <span style={{...styles.orderCell, width: '100px'}}>
                  <span style={styles.orderTotal}>{formatCurrency(getOrderTotal(order.items))}</span>
                </span>
                <span style={{...styles.orderCell, width: '120px'}}>
                  <div style={styles.dateInfo}>
                    <span style={styles.orderDate}>{formatDate(order.created_at)}</span>
                    {order.createdTime && (
                      <span style={styles.orderTime}>{order.createdTime}</span>
                    )}
                  </div>
                </span>
                <span style={{...styles.orderCell, width: '120px'}}>
                  <span style={{
                    ...styles.statusBadge,
                    background: order.statusInfo.bg,
                    color: order.statusInfo.color,
                  }}>
                    {order.statusInfo.label}
                  </span>
                </span>
              </div>
            ))}
          </div>

          {filteredOrders.length === 0 && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>❀</span>
              <p style={styles.emptyText}>No orders found</p>
              <p style={styles.emptySubtext}>Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Panel */}
      {selectedOrder && (
        <div style={styles.detailOverlay} onClick={() => setSelectedOrder(null)}>
          <div style={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedOrder(null)} style={styles.closeBtn}>×</button>
            
            <div style={styles.detailHeader}>
              <div>
                <span style={styles.detailOrderId}>#{selectedOrder.id}</span>
                <span style={{
                  ...styles.statusBadge,
                  background: selectedOrder.statusInfo.bg,
                  color: selectedOrder.statusInfo.color,
                  marginLeft: '12px',
                }}>
                  {selectedOrder.statusInfo.label}
                </span>
              </div>
              <span style={styles.detailDate}>
                {formatDate(selectedOrder.created_at)}
                {selectedOrder.createdTime && ` at ${selectedOrder.createdTime}`}
              </span>
            </div>

            <div style={styles.detailSection}>
              <h4 style={styles.detailSectionTitle}>Customer</h4>
              <div style={styles.customerCard}>
                <div style={styles.customerAvatar}>
                  {selectedOrder.customerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div style={styles.customerDetails}>
                  <span style={styles.customerDetailName}>{selectedOrder.customerName}</span>
                  {selectedOrder.customerEmail && (
                    <span style={styles.customerDetailInfo}>{selectedOrder.customerEmail}</span>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.detailSection}>
              <h4 style={styles.detailSectionTitle}>Items</h4>
              <div style={styles.itemsTable}>
                {selectedOrder.items.map((item, i) => (
                  <div key={i} style={styles.itemRow}>
                    <span style={styles.itemName}>{item.name}</span>
                    <span style={styles.itemQty}>×{item.quantity}</span>
                    <span style={styles.itemPrice}>{formatCurrency(item.quantity * item.price)}</span>
                  </div>
                ))}
                <div style={styles.totalRow}>
                  <span style={styles.totalLabel}>Total</span>
                  <span style={styles.totalAmount}>{formatCurrency(getOrderTotal(selectedOrder.items))}</span>
                </div>
              </div>
            </div>

            {selectedOrder.notes && (
              <div style={styles.detailSection}>
                <h4 style={styles.detailSectionTitle}>Notes</h4>
                <p style={styles.notesText}>{selectedOrder.notes}</p>
              </div>
            )}

            {canEdit && (
              <div style={styles.statusActions}>
                <span style={styles.statusActionsLabel}>Update Status</span>
                <div style={styles.statusButtons}>
                  {['pending', 'confirmed', 'processing', 'completed'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(selectedOrder.id, status)}
                      disabled={updatingStatus || selectedOrder.status === status}
                      style={{
                        ...styles.statusBtn,
                        ...(selectedOrder.status === status ? {
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
                {selectedOrder.status !== 'cancelled' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedOrder.id, 'cancelled')}
                    disabled={updatingStatus}
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
      )}
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
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    padding: '32px 0',
    position: 'relative',
    zIndex: 1,
  },
  statCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
    transition: 'all 0.3s ease',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  statCardHighlight: {
    borderColor: '#f5a623',
    background: 'linear-gradient(135deg, #fff 0%, #fef9f0 100%)',
  },
  statIcon: {
    fontSize: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #fdf2f3 0%, #fce8ea 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
    letterSpacing: '0.5px',
  },
  mainContent: {
    padding: '0 0 48px',
    position: 'relative',
    zIndex: 1,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  filterGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: '"Questrial", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid rgba(0,0,0,0.08)',
    background: 'white',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filterBtnActive: {
    background: '#1a1a1a',
    color: 'white',
    borderColor: '#1a1a1a',
  },
  filterCount: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: '500',
  },
  toolbarRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  searchWrapper: {
    position: 'relative',
    width: '240px',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#aaa',
    fontSize: '16px',
  },
  searchInput: {
    width: '100%',
    padding: '12px 12px 12px 40px',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: '"Questrial", sans-serif',
    background: 'white',
    transition: 'all 0.3s ease',
  },
  btn: {
    padding: '12px 24px',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: '"Questrial", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    letterSpacing: '0.5px',
  },
  btnPrimary: {
    background: '#1a1a1a',
    color: 'white',
  },
  errorCard: {
    background: '#FFEBEE',
    color: '#c62828',
    padding: '16px 24px',
    borderRadius: '12px',
    marginBottom: '24px',
    border: '1px solid #ef9a9a',
  },
  ordersContainer: {
    background: 'white',
    borderRadius: '20px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  tableHeader: {
    display: 'flex',
    padding: '16px 24px',
    background: '#faf8f8',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  tableHeaderCell: {
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#888',
  },
  tableBody: {
    maxHeight: '500px',
    overflowY: 'auto',
  },
  orderRow: {
    display: 'flex',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    alignItems: 'center',
  },
  orderRowSelected: {
    background: 'linear-gradient(90deg, rgba(232,180,184,0.12) 0%, rgba(232,180,184,0.04) 100%)',
  },
  orderCell: {
    display: 'flex',
    alignItems: 'center',
  },
  orderId: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '15px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  customerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  customerName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  customerEmail: {
    fontSize: '12px',
    color: '#999',
  },
  itemsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  itemPill: {
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '6px',
    background: '#f5f0f0',
    color: '#666',
  },
  moreItems: {
    fontSize: '11px',
    color: '#999',
    padding: '4px',
  },
  orderTotal: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '16px',
    fontWeight: '500',
  },
  dateInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  orderDate: {
    fontSize: '13px',
    color: '#1a1a1a',
  },
  orderTime: {
    fontSize: '11px',
    color: '#999',
  },
  statusBadge: {
    fontSize: '11px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontWeight: '500',
    letterSpacing: '0.3px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '48px',
    opacity: 0.3,
    display: 'block',
    marginBottom: '12px',
  },
  emptyText: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '20px',
    color: '#666',
    margin: '0 0 4px 0',
  },
  emptySubtext: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
  },
  detailOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.3)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  detailPanel: {
    background: 'white',
    borderRadius: '24px',
    padding: '36px',
    width: '480px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: '#f5f0f0',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    transition: 'all 0.2s ease',
  },
  detailHeader: {
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  detailOrderId: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
  },
  detailDate: {
    display: 'block',
    fontSize: '13px',
    color: '#888',
    marginTop: '8px',
  },
  detailSection: {
    marginBottom: '24px',
  },
  detailSectionTitle: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    color: '#999',
    margin: '0 0 12px 0',
    fontWeight: '400',
  },
  customerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#faf8f8',
    borderRadius: '12px',
  },
  customerAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #e8b4b8 0%, #d4919a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '16px',
    fontWeight: '500',
  },
  customerDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  customerDetailName: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  customerDetailInfo: {
    fontSize: '13px',
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
    padding: '12px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
  },
  itemName: {
    flex: 1,
    fontSize: '14px',
    color: '#1a1a1a',
  },
  itemQty: {
    fontSize: '13px',
    color: '#888',
    marginRight: '16px',
  },
  itemPrice: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a1a1a',
    minWidth: '60px',
    textAlign: 'right',
  },
  totalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 12px 12px',
    borderTop: '1px solid rgba(0,0,0,0.08)',
    marginTop: '4px',
  },
  totalLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#666',
  },
  totalAmount: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '22px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  notesText: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
    lineHeight: '1.6',
    fontStyle: 'italic',
    padding: '12px 16px',
    background: '#fef9f0',
    borderRadius: '10px',
    borderLeft: '3px solid #f5a623',
  },
  statusActions: {
    paddingTop: '24px',
    borderTop: '1px solid rgba(0,0,0,0.06)',
    marginTop: '8px',
  },
  statusActionsLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    color: '#999',
    display: 'block',
    marginBottom: '12px',
  },
  statusButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  statusBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: '"Questrial", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid rgba(0,0,0,0.1)',
    background: 'white',
    color: '#666',
  },
  cancelBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: '"Questrial", sans-serif',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    background: '#fee',
    color: '#c66',
  },
}

export default OrderList
