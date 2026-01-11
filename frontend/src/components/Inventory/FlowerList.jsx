import React, { useState, useEffect } from 'react'
import { getFlowers, getInventorySummary, deleteFlower } from '../../services/inventory'
import { formatCurrency, hasRole, hasAnyRole } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'
import FlowerForm from './FlowerForm'
import '../../styles/components.css'

// Emoji mapping for flowers (using name or color as fallback)
const getFlowerEmoji = (name, color) => {
  const nameLower = name.toLowerCase()
  if (nameLower.includes('rose') || nameLower.includes('rosa')) return '🌹'
  if (nameLower.includes('peony') || nameLower.includes('peonia')) return '🌸'
  if (nameLower.includes('ranunculus')) return '🏵️'
  if (nameLower.includes('hydrangea')) return '💮'
  if (nameLower.includes('lisianthus')) return '🌷'
  if (nameLower.includes('dahlia')) return '🌺'
  if (nameLower.includes('anemone')) return '⚪'
  if (nameLower.includes('sweet pea')) return '🌼'
  if (nameLower.includes('tulip')) return '🌷'
  if (nameLower.includes('lily')) return '🌺'
  return '🌸'
}

const FlowerList = () => {
  const { getRoles } = useAuth()
  const roles = getRoles()
  const [flowers, setFlowers] = useState([])
  const [inventoryData, setInventoryData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFlower, setSelectedFlower] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingFlower, setEditingFlower] = useState(null)
  const isAdmin = hasRole(roles, 'admin')
  const canEdit = hasAnyRole(roles, ['admin', 'florar'])

  useEffect(() => {
    loadFlowers()
  }, [])

  const loadFlowers = async () => {
    try {
      setLoading(true)
      const [flowersResponse, summaryResponse] = await Promise.all([
        getFlowers(),
        getInventorySummary()
      ])
      setFlowers(flowersResponse.flowers || [])
      setInventoryData(summaryResponse.summary || {})
    } catch (err) {
      setError(err.message || 'Failed to load flowers')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (flowerId) => {
    if (!confirm('Are you sure you want to delete this flower type?')) {
      return
    }

    try {
      await deleteFlower(flowerId)
      await loadFlowers()
      setSelectedFlower(null)
    } catch (err) {
      alert(err.message || 'Failed to delete flower')
    }
  }

  const handleEdit = (flower) => {
    setEditingFlower(flower)
    setShowAddModal(true)
  }

  const handleFormClose = () => {
    setShowAddModal(false)
    setEditingFlower(null)
    loadFlowers()
  }

  // Combine flowers with inventory data
  const flowersWithStock = flowers.map(flower => {
    const stockData = inventoryData[flower.name] || {}
    return {
      ...flower,
      stock: stockData.total_quantity || 0,
      emoji: getFlowerEmoji(flower.name, flower.color)
    }
  })

  const filteredInventory = flowersWithStock.filter(flower =>
    flower.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (flower.color && flower.color.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (flower.seasonality && flower.seasonality.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const totalStock = flowersWithStock.reduce((sum, f) => sum + f.stock, 0)
  const totalValue = flowersWithStock.reduce((sum, f) => sum + (f.stock * f.price_per_unit), 0)
  const lowStockItems = flowersWithStock.filter(f => f.stock < 20).length

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
        
        .flower-card {
          animation: fadeIn 0.6s ease-out forwards;
          opacity: 0;
        }
        
        .flower-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        
        .stat-card:hover {
          transform: translateY(-4px);
        }
        
        .btn:hover {
          transform: scale(1.05);
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
        
        @media (max-width: 768px) {
          .stat-card {
            padding: 16px !important;
          }
        }
      `}</style>

      {/* Background decorative elements */}
      <div style={styles.bgDecor1}></div>
      <div style={styles.bgDecor2}></div>
      <div style={styles.bgDecor3}></div>

      {/* Stats Row */}
      <div style={styles.statsRow}>
        <div style={styles.statCard} className="stat-card">
          <div style={styles.statIcon}>✿</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{totalStock}</span>
            <span style={styles.statLabel}>Total Stems</span>
          </div>
        </div>
        <div style={styles.statCard} className="stat-card">
          <div style={styles.statIcon}>❁</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{flowers.length}</span>
            <span style={styles.statLabel}>Varieties</span>
          </div>
        </div>
        <div style={styles.statCard} className="stat-card">
          <div style={styles.statIcon}>✾</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{formatCurrency(totalValue)}</span>
            <span style={styles.statLabel}>Inventory Value</span>
          </div>
        </div>
        <div style={{...styles.statCard, ...(lowStockItems > 0 ? styles.statCardWarning : {})}} className="stat-card">
          <div style={styles.statIcon}>❃</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{lowStockItems}</span>
            <span style={styles.statLabel}>Low Stock</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>⌕</span>
            <input
              type="text"
              placeholder="Search blooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          {canEdit && (
            <div style={styles.toolbarActions}>
              <button
                onClick={() => setEditMode(!editMode)}
                style={{...styles.btn, ...(editMode ? styles.btnActive : styles.btnSecondary)}}
                className="btn"
              >
                {editMode ? '✓ Done Editing' : '✎ Edit Mode'}
              </button>
              <button
                onClick={() => {
                  setEditingFlower(null)
                  setShowAddModal(true)
                }}
                style={{...styles.btn, ...styles.btnPrimary}}
                className="btn"
              >
                + Add Bloom
              </button>
            </div>
          )}
        </div>

        {error && (
          <div style={styles.errorCard}>
            {error}
          </div>
        )}

        {/* Inventory Grid */}
        <div style={styles.inventoryGrid}>
          {filteredInventory.map((flower, index) => (
            <div
              key={flower.id}
              className="flower-card"
              style={{
                ...styles.flowerCard,
                animationDelay: `${index * 0.1}s`,
                ...(selectedFlower?.id === flower.id ? styles.flowerCardSelected : {}),
                ...(flower.stock < 20 ? styles.flowerCardLowStock : {})
              }}
              onClick={() => setSelectedFlower(flower)}
            >
              <div style={styles.flowerImageWrapper}>
                <span style={styles.flowerEmoji}>{flower.emoji}</span>
                {flower.stock < 20 && <span style={styles.lowStockBadge}>Low</span>}
              </div>
              <div style={styles.flowerInfo}>
                <h3 style={styles.flowerName}>{flower.name}</h3>
                {flower.seasonality && flower.seasonality !== 'all' && (
                  <p style={styles.flowerVariety}>{flower.seasonality}</p>
                )}
                {flower.color && (
                  <p style={styles.flowerColor}>
                    <span style={styles.colorDot}></span>
                    {flower.color}
                  </p>
                )}
              </div>
              <div style={styles.flowerMeta}>
                <div style={styles.stockDisplay}>
                  <span style={styles.stockText}>{flower.stock} stems</span>
                </div>
                <span style={styles.priceTag}>{formatCurrency(flower.price_per_unit)}</span>
              </div>
              {editMode && canEdit && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(flower); }}
                    style={styles.editBtn}
                  >
                    ✎
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(flower.id); }}
                      style={styles.deleteBtn}
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {filteredInventory.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>❀</span>
            <p style={styles.emptyText}>No blooms found</p>
            <p style={styles.emptySubtext}>Try a different search term</p>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedFlower && (
        <div style={styles.detailOverlay} onClick={() => setSelectedFlower(null)}>
          <div style={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedFlower(null)} style={styles.closeBtn}>×</button>
            <div style={styles.detailHeader}>
              <span style={styles.detailEmoji}>{selectedFlower.emoji}</span>
              <div>
                <h2 style={styles.detailName}>{selectedFlower.name}</h2>
                {selectedFlower.seasonality && selectedFlower.seasonality !== 'all' && (
                  <p style={styles.detailVariety}>{selectedFlower.seasonality}</p>
                )}
              </div>
            </div>
            <div style={styles.detailBody}>
              {selectedFlower.color && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Color</span>
                  <span style={styles.detailValue}>{selectedFlower.color}</span>
                </div>
              )}
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Current Stock</span>
                <span style={styles.detailValue}>{selectedFlower.stock} stems</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Price per Stem</span>
                <span style={styles.detailValue}>{formatCurrency(selectedFlower.price_per_unit)}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Total Value</span>
                <span style={styles.detailValue}>{formatCurrency(selectedFlower.stock * selectedFlower.price_per_unit)}</span>
              </div>
              {selectedFlower.description && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Description</span>
                  <span style={styles.detailValue}>{selectedFlower.description}</span>
                </div>
              )}
              {canEdit && (
                <div style={styles.quickActions}>
                  <button
                    onClick={() => {
                      handleEdit(selectedFlower)
                      setSelectedFlower(null)
                    }}
                    style={{...styles.btn, ...styles.btnSecondary, flex: 1}}
                    className="btn"
                  >
                    Edit Flower
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div style={styles.detailOverlay} onClick={() => setShowAddModal(false)}>
          <div style={styles.addModal} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAddModal(false)} style={styles.closeBtn}>×</button>
            <h2 style={styles.modalTitle}>{editingFlower ? 'Edit Bloom' : 'Add New Bloom'}</h2>
            <FlowerForm
              flower={editingFlower}
              onClose={handleFormClose}
              inModal={true}
            />
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
    background: 'radial-gradient(circle, rgba(232,180,184,0.15) 0%, transparent 70%)',
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
    background: 'radial-gradient(circle, rgba(232,180,184,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  bgDecor3: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '800px',
    height: '800px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 60%)',
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
  statCardWarning: {
    borderColor: '#e8b4b8',
    background: 'linear-gradient(135deg, #fff 0%, #fff5f5 100%)',
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
  mainContent: {
    padding: '0 0 48px',
    position: 'relative',
    zIndex: 1,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  },
  searchWrapper: {
    position: 'relative',
    width: '320px',
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#aaa',
    fontSize: '18px',
  },
  searchInput: {
    width: '100%',
    padding: '14px 14px 14px 48px',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '12px',
    fontSize: '14px',
    fontFamily: '"Questrial", sans-serif',
    background: 'white',
    transition: 'all 0.3s ease',
  },
  toolbarActions: {
    display: 'flex',
    gap: '12px',
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
  btnSecondary: {
    background: '#f5f0f0',
    color: '#1a1a1a',
  },
  btnActive: {
    background: '#d4919a',
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
  inventoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  flowerCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    position: 'relative',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  flowerCardSelected: {
    borderColor: '#d4919a',
    boxShadow: '0 8px 30px rgba(212,145,154,0.2)',
  },
  flowerCardLowStock: {
    background: 'linear-gradient(135deg, #fff 0%, #fffafa 100%)',
  },
  flowerImageWrapper: {
    position: 'relative',
    marginBottom: '16px',
  },
  flowerEmoji: {
    fontSize: '48px',
    display: 'block',
  },
  lowStockBadge: {
    position: 'absolute',
    top: '0',
    right: '0',
    background: '#d4919a',
    color: 'white',
    fontSize: '10px',
    padding: '4px 10px',
    borderRadius: '20px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  flowerInfo: {
    marginBottom: '16px',
  },
  flowerName: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '20px',
    fontWeight: '500',
    margin: '0 0 4px 0',
    color: '#1a1a1a',
  },
  flowerVariety: {
    fontSize: '13px',
    color: '#888',
    margin: '0 0 8px 0',
    textTransform: 'capitalize',
  },
  flowerColor: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  colorDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #e8b4b8 0%, #d4919a 100%)',
  },
  flowerMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid rgba(0,0,0,0.06)',
  },
  stockDisplay: {
    display: 'flex',
    alignItems: 'center',
  },
  stockText: {
    fontSize: '13px',
    color: '#666',
  },
  priceTag: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '18px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  editBtn: {
    position: 'absolute',
    top: '12px',
    right: '48px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 'none',
    background: '#f5f0f0',
    color: '#666',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  deleteBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 'none',
    background: '#fee',
    color: '#c66',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    opacity: 0.3,
    display: 'block',
    marginBottom: '16px',
  },
  emptyText: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '24px',
    color: '#666',
    margin: '0 0 8px 0',
  },
  emptySubtext: {
    fontSize: '14px',
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
    animation: 'fadeIn 0.3s ease',
  },
  detailPanel: {
    background: 'white',
    borderRadius: '24px',
    padding: '40px',
    width: '400px',
    maxWidth: '90vw',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    maxHeight: '90vh',
    overflowY: 'auto',
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
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  detailEmoji: {
    fontSize: '64px',
  },
  detailName: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
    margin: '0 0 4px 0',
  },
  detailVariety: {
    fontSize: '14px',
    color: '#888',
    margin: 0,
    textTransform: 'capitalize',
  },
  detailBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: '13px',
    color: '#888',
  },
  detailValue: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  quickActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
    paddingTop: '24px',
    borderTop: '1px solid rgba(0,0,0,0.06)',
  },
  addModal: {
    background: 'white',
    borderRadius: '24px',
    padding: '40px',
    width: '480px',
    maxWidth: '90vw',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
    margin: '0 0 32px 0',
    textAlign: 'center',
  },
}

export default FlowerList
