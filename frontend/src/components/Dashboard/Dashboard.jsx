import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getInventorySummary } from '../../services/inventory'
import { getOrders } from '../../services/orders'
import { getExpiringLots } from '../../services/inventory'
import { formatCurrency, formatDate, hasAnyRole } from '../../utils/helpers'
import '../../styles/components.css'

const Dashboard = () => {
  const navigate = useNavigate()
  const { getRoles } = useAuth()
  const roles = getRoles()
  const [stats, setStats] = useState({
    totalFlowers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    expiringLots: 0
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load inventory summary if admin or florar
      if (hasAnyRole(roles, ['admin', 'florar'])) {
        try {
          const inventorySummary = await getInventorySummary()
          const summary = inventorySummary.summary || {}
          const totalFlowers = Object.keys(summary).length
          setStats(prev => ({ ...prev, totalFlowers }))
        } catch (e) {
          console.error('Error loading inventory summary:', e)
        }

        // Load expiring lots
        try {
          const expiring = await getExpiringLots(7)
          setStats(prev => ({ ...prev, expiringLots: expiring.lots?.length || 0 }))
        } catch (e) {
          console.error('Error loading expiring lots:', e)
        }
      }

      // Load orders
      try {
        const ordersData = await getOrders()
        const orders = ordersData.orders || []
        setStats(prev => ({
          ...prev,
          totalOrders: orders.length,
          totalRevenue: orders.reduce((sum, order) => sum + (order.total_price || 0), 0)
        }))
        setRecentOrders(orders.slice(0, 5))
      } catch (e) {
        console.error('Error loading orders:', e)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  const isAdmin = roles.includes('admin')
  const isFlorar = roles.includes('florar')
  const isClient = roles.includes('client') || (!isAdmin && !isFlorar)

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Questrial&display=swap');
        
        * { box-sizing: border-box; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .stat-card {
          animation: fadeIn 0.6s ease-out forwards;
          opacity: 0;
        }
        
        .stat-card:hover {
          transform: translateY(-4px);
        }
        
        .order-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }
        
        .btn:hover {
          transform: scale(1.03);
        }
        
        .btn:active {
          transform: scale(0.98);
        }
        
        input:focus, textarea:focus {
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

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>Overview of your floristry operations</p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={styles.statsRow}>
        {hasAnyRole(roles, ['admin', 'florar']) && (
          <div style={{...styles.statCard, animationDelay: '0.1s'}} className="stat-card">
            <div style={styles.statIcon}>✿</div>
            <div style={styles.statInfo}>
              <span style={styles.statValue}>{stats.totalFlowers}</span>
              <span style={styles.statLabel}>Flower Types</span>
            </div>
          </div>
        )}
        
        <div style={{...styles.statCard, animationDelay: '0.2s'}} className="stat-card">
          <div style={styles.statIcon}>❋</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{stats.totalOrders}</span>
            <span style={styles.statLabel}>Total Orders</span>
          </div>
        </div>
        
        {isAdmin && (
          <div style={{...styles.statCard, animationDelay: '0.3s'}} className="stat-card">
            <div style={styles.statIcon}>◈</div>
            <div style={styles.statInfo}>
              <span style={styles.statValue}>{formatCurrency(stats.totalRevenue)}</span>
              <span style={styles.statLabel}>Total Revenue</span>
            </div>
          </div>
        )}
        
        {hasAnyRole(roles, ['admin', 'florar']) && (
          <div style={{...styles.statCard, ...(stats.expiringLots > 0 ? styles.statCardWarning : {}), animationDelay: '0.4s'}} className="stat-card">
            <div style={styles.statIcon}>❃</div>
            <div style={styles.statInfo}>
              <span style={styles.statValue}>{stats.expiringLots}</span>
              <span style={styles.statLabel}>Expiring Lots (7 days)</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Orders */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Recent Orders</h2>
          <Link to="/orders" style={styles.viewAllLink}>
            View All Orders →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>❀</span>
            <p style={styles.emptyText}>No orders yet</p>
            <p style={styles.emptySubtext}>Orders will appear here once created</p>
          </div>
        ) : (
          <div style={styles.ordersGrid}>
            {recentOrders.map((order, index) => (
              <div
                key={order.id}
                style={{...styles.orderCard, animationDelay: `${index * 0.1}s`}}
                className="order-card"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <div style={styles.orderCardHeader}>
                  <span style={styles.orderId}>#{order.id}</span>
                  <span style={{
                    ...styles.statusBadge,
                    background: getStatusColor(order.status).bg,
                    color: getStatusColor(order.status).color,
                  }}>
                    {order.status}
                  </span>
                </div>
                <div style={styles.orderCardBody}>
                  <div style={styles.orderTotal}>{formatCurrency(order.total_price)}</div>
                  <div style={styles.orderDate}>{formatDate(order.created_at)}</div>
                </div>
                <div style={styles.orderCardFooter}>
                  <span style={styles.viewDetails}>View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client Section */}
      {isClient && (
        <div style={styles.section}>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🌸</div>
            <div style={styles.featureContent}>
              <h3 style={styles.featureTitle}>Create a Bouquet</h3>
              <p style={styles.featureDescription}>
                Use our bouquet builder to create custom flower arrangements based on your budget and preferences.
              </p>
              <Link to="/bouquet" style={styles.featureButton}>
                Start Building
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const getStatusColor = (status) => {
  const colors = {
    pending: { color: '#f5a623', bg: '#fef7e8' },
    confirmed: { color: '#4a90d9', bg: '#e8f2fc' },
    processing: { color: '#7b68ee', bg: '#f0effe' },
    completed: { color: '#50c878', bg: '#e8f8ee' },
    cancelled: { color: '#999', bg: '#f5f5f5' },
  }
  return colors[status] || { color: '#666', bg: '#f5f5f5' }
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
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '48px',
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
  statCardWarning: {
    borderColor: '#f5a623',
    background: 'linear-gradient(135deg, #fff 0%, #fef9f0 100%)',
  },
  statIcon: {
    fontSize: '28px',
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
  section: {
    marginBottom: '48px',
    position: 'relative',
    zIndex: 1,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
    margin: 0,
    color: '#1a1a1a',
  },
  viewAllLink: {
    fontSize: '13px',
    color: '#d4919a',
    textDecoration: 'none',
    letterSpacing: '0.5px',
    transition: 'all 0.2s ease',
  },
  ordersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  },
  orderCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    border: '1px solid rgba(0,0,0,0.04)',
    animation: 'fadeIn 0.5s ease-out forwards',
    opacity: 0,
  },
  orderCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  orderId: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '18px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  statusBadge: {
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontWeight: '500',
    letterSpacing: '0.3px',
  },
  orderCardBody: {
    marginBottom: '16px',
  },
  orderTotal: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '24px',
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: '4px',
  },
  orderDate: {
    fontSize: '12px',
    color: '#999',
  },
  orderCardFooter: {
    paddingTop: '16px',
    borderTop: '1px solid rgba(0,0,0,0.06)',
  },
  viewDetails: {
    fontSize: '13px',
    color: '#d4919a',
    letterSpacing: '0.5px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
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
  featureCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    display: 'flex',
    alignItems: 'center',
    gap: '32px',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  featureIcon: {
    fontSize: '64px',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
    margin: '0 0 12px 0',
    color: '#1a1a1a',
  },
  featureDescription: {
    fontSize: '15px',
    color: '#666',
    lineHeight: '1.6',
    margin: '0 0 24px 0',
  },
  featureButton: {
    display: 'inline-block',
    padding: '14px 28px',
    borderRadius: '10px',
    fontSize: '14px',
    fontFamily: '"Questrial", sans-serif',
    background: '#1a1a1a',
    color: 'white',
    textDecoration: 'none',
    letterSpacing: '0.5px',
    transition: 'all 0.2s ease',
    border: 'none',
    cursor: 'pointer',
  },
}

export default Dashboard
