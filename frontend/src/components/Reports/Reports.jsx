import React, { useState, useEffect } from 'react'
import {
  getDashboardReport,
  getSalesSummary,
  getDailySales,
  getInventoryLevels,
  getLowStock,
  getExpiringStock,
  getTopProducts,
  getOrdersByStatus,
  getPaymentStatus,
  exportDashboardPDF,
  exportSalesPDF,
  exportInventoryPDF,
  exportOrdersPDF
} from '../../services/reports'
import { formatCurrency } from '../../utils/helpers'
import '../../styles/components.css'

const Reports = () => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  
  // Dashboard data
  const [dashboardData, setDashboardData] = useState(null)
  
  // Sales data
  const [salesSummary, setSalesSummary] = useState(null)
  const [dailySales, setDailySales] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Inventory data
  const [inventoryLevels, setInventoryLevels] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [expiringStock, setExpiringStock] = useState([])
  
  // Order data
  const [ordersByStatus, setOrdersByStatus] = useState([])
  const [paymentStatus, setPaymentStatus] = useState([])
  const [topProducts, setTopProducts] = useState([])

  useEffect(() => {
    // Set default date range (last 30 days)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
    
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getDashboardReport()
      setDashboardData(response.data)
    } catch (err) {
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadSalesReports = async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryRes, dailyRes] = await Promise.all([
        getSalesSummary(startDate, endDate),
        getDailySales(startDate, endDate)
      ])
      setSalesSummary(summaryRes.data)
      setDailySales(dailyRes.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load sales reports')
    } finally {
      setLoading(false)
    }
  }

  const loadInventoryReports = async () => {
    setLoading(true)
    setError('')
    try {
      const [levelsRes, lowRes, expiringRes] = await Promise.all([
        getInventoryLevels(),
        getLowStock(10),
        getExpiringStock(7)
      ])
      setInventoryLevels(levelsRes.data || [])
      setLowStock(lowRes.data || [])
      setExpiringStock(expiringRes.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load inventory reports')
    } finally {
      setLoading(false)
    }
  }

  const loadOrderReports = async () => {
    setLoading(true)
    setError('')
    try {
      const [statusRes, paymentRes, topRes] = await Promise.all([
        getOrdersByStatus(),
        getPaymentStatus(),
        getTopProducts(10, startDate, endDate)
      ])
      setOrdersByStatus(statusRes.data || [])
      setPaymentStatus(paymentRes.data || [])
      setTopProducts(topRes.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load order reports')
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setError('')
    
    switch (tab) {
      case 'dashboard':
        loadDashboard()
        break
      case 'sales':
        loadSalesReports()
        break
      case 'inventory':
        loadInventoryReports()
        break
      case 'orders':
        loadOrderReports()
        break
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    setError('')
    try {
      switch (activeTab) {
        case 'dashboard':
          await exportDashboardPDF()
          break
        case 'sales':
          await exportSalesPDF(startDate, endDate)
          break
        case 'inventory':
          await exportInventoryPDF()
          break
        case 'orders':
          await exportOrdersPDF(startDate, endDate)
          break
      }
    } catch (err) {
      setError('Failed to export PDF: ' + (err.message || 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  const renderDashboard = () => {
    if (!dashboardData) return null
    
    const { sales_last_30_days, orders_by_status, low_stock_items, expiring_soon_lots } = dashboardData
    
    return (
      <div style={styles.dashboardGrid}>
        {/* Sales Summary Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📈 Vânzări (ultimele 30 zile)</h3>
          <div style={styles.statGrid}>
            <div style={styles.stat}>
              <span style={styles.statValue}>{sales_last_30_days?.total_orders || 0}</span>
              <span style={styles.statLabel}>Comenzi</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{formatCurrency(sales_last_30_days?.total_revenue || 0)}</span>
              <span style={styles.statLabel}>Venituri</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{formatCurrency(sales_last_30_days?.average_order_value || 0)}</span>
              <span style={styles.statLabel}>Valoare Medie</span>
            </div>
          </div>
        </div>
        
        {/* Orders by Status Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📦 Comenzi pe Status</h3>
          <div style={styles.statusList}>
            {orders_by_status?.map((item, idx) => (
              <div key={idx} style={styles.statusItem}>
                <span style={styles.statusBadge}>{item.status}</span>
                <span style={styles.statusCount}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Alerts Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>⚠️ Alerte</h3>
          <div style={styles.alertList}>
            <div style={{...styles.alertItem, ...(low_stock_items > 0 ? styles.alertWarning : {})}}>
              <span>Produse cu stoc scăzut</span>
              <span style={styles.alertCount}>{low_stock_items}</span>
            </div>
            <div style={{...styles.alertItem, ...(expiring_soon_lots > 0 ? styles.alertDanger : {})}}>
              <span>Loturi ce expiră în 7 zile</span>
              <span style={styles.alertCount}>{expiring_soon_lots}</span>
            </div>
          </div>
        </div>
        
        {/* Database Source Info */}
        <div style={styles.infoCard}>
          <span style={styles.infoIcon}>🔄</span>
          <span>Rapoartele sunt generate din <strong>read-replica</strong> pentru a nu încărca baza de date principală</span>
        </div>
      </div>
    )
  }

  const renderSalesReports = () => (
    <div>
      {/* Date Filters */}
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Data Start:</label>
          <input
            type="date"
            style={styles.filterInput}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Data Sfârșit:</label>
          <input
            type="date"
            style={styles.filterInput}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button style={styles.filterButton} onClick={loadSalesReports}>
          Actualizează
        </button>
      </div>

      {/* Sales Summary */}
      {salesSummary && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Sumar Vânzări</h3>
          <div style={styles.statGrid}>
            <div style={styles.stat}>
              <span style={styles.statValue}>{salesSummary.total_orders}</span>
              <span style={styles.statLabel}>Total Comenzi</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{formatCurrency(salesSummary.total_revenue)}</span>
              <span style={styles.statLabel}>Venituri Totale</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{formatCurrency(salesSummary.average_order_value)}</span>
              <span style={styles.statLabel}>Valoare Medie</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{salesSummary.completed_orders}</span>
              <span style={styles.statLabel}>Finalizate</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{salesSummary.paid_orders}</span>
              <span style={styles.statLabel}>Plătite</span>
            </div>
          </div>
        </div>
      )}

      {/* Daily Sales Table */}
      {dailySales.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Vânzări Zilnice</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Data</th>
                <th style={styles.th}>Comenzi</th>
                <th style={styles.th}>Venituri</th>
              </tr>
            </thead>
            <tbody>
              {dailySales.map((day, idx) => (
                <tr key={idx} style={styles.tr}>
                  <td style={styles.td}>{day.date}</td>
                  <td style={styles.td}>{day.order_count}</td>
                  <td style={styles.td}>{formatCurrency(day.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderInventoryReports = () => (
    <div>
      {/* Inventory Levels */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Niveluri Stoc</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Floare</th>
              <th style={styles.th}>Culoare</th>
              <th style={styles.th}>Preț/Unitate</th>
              <th style={styles.th}>Disponibil</th>
              <th style={styles.th}>Loturi</th>
            </tr>
          </thead>
          <tbody>
            {inventoryLevels.map((item, idx) => (
              <tr key={idx} style={{...styles.tr, ...(item.available_stock < 10 ? styles.lowStockRow : {})}}>
                <td style={styles.td}>{item.name}</td>
                <td style={styles.td}>{item.color || '-'}</td>
                <td style={styles.td}>{formatCurrency(item.price_per_unit)}</td>
                <td style={styles.td}>{item.available_stock}</td>
                <td style={styles.td}>{item.lot_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div style={{...styles.card, ...styles.warningCard}}>
          <h3 style={styles.cardTitle}>⚠️ Stoc Scăzut (sub 10 unități)</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Floare</th>
                <th style={styles.th}>Culoare</th>
                <th style={styles.th}>Stoc Disponibil</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((item, idx) => (
                <tr key={idx} style={styles.tr}>
                  <td style={styles.td}>{item.name}</td>
                  <td style={styles.td}>{item.color || '-'}</td>
                  <td style={{...styles.td, color: '#dc3545', fontWeight: 'bold'}}>{item.available_stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expiring Stock */}
      {expiringStock.length > 0 && (
        <div style={{...styles.card, ...styles.dangerCard}}>
          <h3 style={styles.cardTitle}>🕐 Loturi ce Expiră în 7 Zile</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Floare</th>
                <th style={styles.th}>Cantitate</th>
                <th style={styles.th}>Data Expirare</th>
              </tr>
            </thead>
            <tbody>
              {expiringStock.map((item, idx) => (
                <tr key={idx} style={styles.tr}>
                  <td style={styles.td}>{item.flower_name}</td>
                  <td style={styles.td}>{item.quantity}</td>
                  <td style={{...styles.td, color: '#dc3545'}}>{item.expiry_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderOrderReports = () => (
    <div>
      <div style={styles.reportRow}>
        {/* Orders by Status */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Comenzi pe Status</h3>
          <div style={styles.statusList}>
            {ordersByStatus.map((item, idx) => (
              <div key={idx} style={styles.statusItem}>
                <span style={styles.statusBadge}>{item.status}</span>
                <span style={styles.statusCount}>{item.count} ({formatCurrency(item.total_value)})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Status */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Status Plăți</h3>
          <div style={styles.statusList}>
            {paymentStatus.map((item, idx) => (
              <div key={idx} style={styles.statusItem}>
                <span style={{...styles.statusBadge, backgroundColor: item.payment_status === 'paid' ? '#28a745' : '#ffc107'}}>
                  {item.payment_status}
                </span>
                <span style={styles.statusCount}>{item.count} ({formatCurrency(item.total_value)})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🏆 Top Produse Vândute</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Produs</th>
                <th style={styles.th}>Cantitate Vândută</th>
                <th style={styles.th}>Venituri</th>
                <th style={styles.th}>Comenzi</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((item, idx) => (
                <tr key={idx} style={styles.tr}>
                  <td style={styles.td}>{idx + 1}</td>
                  <td style={styles.td}>{item.flower_name}</td>
                  <td style={styles.td}>{item.total_quantity}</td>
                  <td style={styles.td}>{formatCurrency(item.total_revenue)}</td>
                  <td style={styles.td}>{item.order_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Questrial&display=swap');
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>📊 Rapoarte</h1>
        <p style={styles.subtitle}>Date din read-replica PostgreSQL</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button 
          style={{...styles.tab, ...(activeTab === 'dashboard' ? styles.activeTab : {})}}
          onClick={() => handleTabChange('dashboard')}
        >
          Dashboard
        </button>
        <button 
          style={{...styles.tab, ...(activeTab === 'sales' ? styles.activeTab : {})}}
          onClick={() => handleTabChange('sales')}
        >
          Vânzări
        </button>
        <button 
          style={{...styles.tab, ...(activeTab === 'inventory' ? styles.activeTab : {})}}
          onClick={() => handleTabChange('inventory')}
        >
          Inventar
        </button>
        <button 
          style={{...styles.tab, ...(activeTab === 'orders' ? styles.activeTab : {})}}
          onClick={() => handleTabChange('orders')}
        >
          Comenzi
        </button>
        
        {/* Export PDF Button */}
        <button 
          style={styles.exportButton}
          onClick={handleExportPDF}
          disabled={loading || exporting}
        >
          {exporting ? '⏳ Exportare...' : '📄 Export PDF'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <span>Se încarcă raportul...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <div style={styles.content}>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'sales' && renderSalesReports()}
          {activeTab === 'inventory' && renderInventoryReports()}
          {activeTab === 'orders' && renderOrderReports()}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: "'Questrial', sans-serif",
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #fdf6f7 0%, #f8f0f5 100%)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '2.5rem',
    color: '#2c3e50',
    margin: '0 0 10px 0'
  },
  subtitle: {
    color: '#7f8c8d',
    fontSize: '1rem',
    margin: 0
  },
  tabs: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '30px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '25px',
    background: '#fff',
    color: '#666',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  activeTab: {
    background: 'linear-gradient(135deg, #e8b4b8 0%, #d4a5a5 100%)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(232, 180, 184, 0.4)'
  },
  exportButton: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '25px',
    background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 8px rgba(156, 39, 176, 0.3)',
    marginLeft: 'auto'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
    padding: '60px 0',
    color: '#666'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #e8b4b8',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  error: {
    background: '#fee',
    color: '#c00',
    padding: '15px 20px',
    borderRadius: '8px',
    textAlign: 'center',
    margin: '20px 0'
  },
  content: {
    animation: 'fadeIn 0.3s ease'
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '25px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
  },
  cardTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.3rem',
    color: '#2c3e50',
    marginTop: 0,
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '2px solid #f8f0f5'
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '15px'
  },
  stat: {
    textAlign: 'center',
    padding: '15px 10px',
    background: '#fdf6f7',
    borderRadius: '12px'
  },
  statValue: {
    display: 'block',
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#e8b4b8'
  },
  statLabel: {
    fontSize: '0.85rem',
    color: '#7f8c8d',
    marginTop: '5px',
    display: 'block'
  },
  statusList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  statusItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 15px',
    background: '#fdf6f7',
    borderRadius: '8px'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    background: '#e8b4b8',
    color: '#fff',
    textTransform: 'capitalize'
  },
  statusCount: {
    fontWeight: '600',
    color: '#2c3e50'
  },
  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  alertItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 15px',
    background: '#f8f9fa',
    borderRadius: '8px',
    borderLeft: '4px solid #dee2e6'
  },
  alertWarning: {
    background: '#fff3cd',
    borderLeftColor: '#ffc107'
  },
  alertDanger: {
    background: '#f8d7da',
    borderLeftColor: '#dc3545'
  },
  alertCount: {
    fontWeight: 'bold',
    fontSize: '1.2rem'
  },
  infoCard: {
    gridColumn: '1 / -1',
    background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    padding: '15px 20px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#1565c0'
  },
  infoIcon: {
    fontSize: '1.5rem'
  },
  filters: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    alignItems: 'flex-end'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  filterLabel: {
    fontSize: '0.85rem',
    color: '#666'
  },
  filterInput: {
    padding: '10px 15px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '1rem'
  },
  filterButton: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #e8b4b8 0%, #d4a5a5 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px 15px',
    background: '#fdf6f7',
    color: '#2c3e50',
    fontWeight: '600',
    borderBottom: '2px solid #e8b4b8'
  },
  tr: {
    borderBottom: '1px solid #eee'
  },
  td: {
    padding: '12px 15px',
    color: '#555'
  },
  lowStockRow: {
    background: '#fff3cd'
  },
  warningCard: {
    borderLeft: '4px solid #ffc107'
  },
  dangerCard: {
    borderLeft: '4px solid #dc3545'
  },
  reportRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '20px'
  }
}

export default Reports
