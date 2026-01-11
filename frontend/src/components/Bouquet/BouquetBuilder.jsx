import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBouquetPreview, getBouquetRules } from '../../services/bouquets'
import { createOrder } from '../../services/orders'
import { getFlowers } from '../../services/inventory'
import { formatCurrency } from '../../utils/helpers'
import '../../styles/components.css'

const BouquetBuilder = () => {
  const navigate = useNavigate()
  const [budget, setBudget] = useState('')
  const [colors, setColors] = useState('')
  const [season, setSeason] = useState('')
  const [style, setStyle] = useState('')
  const [configurations, setConfigurations] = useState([])
  const [rules, setRules] = useState(null)
  const [flowers, setFlowers] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingRules, setLoadingRules] = useState(true)
  const [error, setError] = useState('')
  const [selectedConfig, setSelectedConfig] = useState(null)
  const [creatingOrder, setCreatingOrder] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoadingRules(true)
      const [rulesResponse, flowersResponse] = await Promise.all([
        getBouquetRules(),
        getFlowers()
      ])
      setRules(rulesResponse.rules)
      setFlowers(flowersResponse.flowers || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoadingRules(false)
    }
  }

  const getFlowerName = (flowerTypeId) => {
    const flower = flowers.find(f => f.id === flowerTypeId)
    return flower ? flower.name : `Flower #${flowerTypeId}`
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!budget || parseFloat(budget) <= 0) {
      setError('Please enter a valid budget')
      return
    }

    setLoading(true)
    setError('')
    setConfigurations([])
    setSelectedConfig(null)

    try {
      const filters = {
        budget: parseFloat(budget)
      }
      if (colors) filters.colors = colors
      if (season) filters.season = season
      if (style) filters.style = style

      const response = await getBouquetPreview(filters)
      setConfigurations(response.configurations || [])
      
      if (!response.configurations || response.configurations.length === 0) {
        setError('No bouquet configurations found matching your criteria')
      }
    } catch (err) {
      setError(err.message || 'Failed to generate bouquet configurations')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrder = async (config) => {
    if (!confirm('Create an order with this bouquet configuration?')) {
      return
    }

    setCreatingOrder(true)
    try {
      const items = config.items.map(item => ({
        flower_type_id: item.flower_type_id,
        quantity: item.quantity
      }))

      const orderData = {
        items,
        notes: `Bouquet: ${colors || 'Mixed'} ${season || 'All season'} ${style || 'Standard'}`
      }

      const response = await createOrder(orderData)
      navigate(`/orders/${response.order.id}`)
    } catch (err) {
      alert(err.message || 'Failed to create order')
    } finally {
      setCreatingOrder(false)
    }
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
        
        .config-card {
          animation: fadeIn 0.6s ease-out forwards;
          opacity: 0;
        }
        
        .config-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.1);
        }
        
        .btn:hover {
          transform: scale(1.03);
        }
        
        .btn:active {
          transform: scale(0.98);
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

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Bouquet Builder</h1>
          <p style={styles.subtitle}>Create custom flower arrangements</p>
        </div>
      </div>

      {/* Form Section */}
      <div style={styles.formSection}>
        <form onSubmit={handleSearch}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Budget *</label>
              <input
                type="number"
                style={styles.formInput}
                min="0"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
                placeholder="Enter budget"
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Colors</label>
              <input
                type="text"
                style={styles.formInput}
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                placeholder="e.g., pink, purple"
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Season</label>
              <select
                style={styles.formInput}
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                <option value="">All Seasons</option>
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="autumn">Autumn</option>
                <option value="winter">Winter</option>
              </select>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Style</label>
              <input
                type="text"
                style={styles.formInput}
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="e.g., modern, classic"
              />
            </div>
          </div>
          
          {error && (
            <div style={styles.errorCard}>
              {error}
            </div>
          )}
          
          <button
            type="submit"
            style={{...styles.btn, ...styles.btnPrimary, width: '100%', marginTop: '24px'}}
            className="btn"
            disabled={loading}
          >
            {loading ? 'Generating Bouquets...' : 'Generate Bouquet Configurations'}
          </button>
        </form>
      </div>

      {/* Rules Section */}
      {loadingRules ? (
        <div style={styles.loadingState}>
          <div className="spinner"></div>
        </div>
      ) : rules && (
        <div style={styles.rulesCard}>
          <h3 style={styles.rulesTitle}>Bouquet Rules</h3>
          <div style={styles.rulesGrid}>
            <div style={styles.ruleItem}>
              <span style={styles.ruleLabel}>Min Flowers:</span>
              <span style={styles.ruleValue}>{rules.min_flowers_per_bouquet}</span>
            </div>
            <div style={styles.ruleItem}>
              <span style={styles.ruleLabel}>Max Flowers:</span>
              <span style={styles.ruleValue}>{rules.max_flowers_per_bouquet}</span>
            </div>
            <div style={styles.ruleItem}>
              <span style={styles.ruleLabel}>Min Types:</span>
              <span style={styles.ruleValue}>{rules.min_flower_types}</span>
            </div>
            <div style={styles.ruleItem}>
              <span style={styles.ruleLabel}>Max Types:</span>
              <span style={styles.ruleValue}>{rules.max_flower_types}</span>
            </div>
          </div>
        </div>
      )}

      {/* Configurations */}
      {configurations.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            Generated Configurations ({configurations.length})
          </h2>
          <div style={styles.configsGrid}>
            {configurations.map((config, index) => {
              const total = config.total_price || config.items.reduce((sum, item) => sum + ((item.unit_price || item.price) * item.quantity), 0)
              return (
                <div
                  key={index}
                  style={{...styles.configCard, animationDelay: `${index * 0.1}s`}}
                  className="config-card"
                >
                  <div style={styles.configHeader}>
                    <h3 style={styles.configNumber}>Configuration {index + 1}</h3>
                    <span style={styles.configTotal}>{formatCurrency(total)}</span>
                  </div>
                  
                  <div style={styles.configItems}>
                    {config.items.map((item, itemIndex) => (
                      <div key={itemIndex} style={styles.configItem}>
                        <span style={styles.itemName}>
                          {item.flower_name || getFlowerName(item.flower_type_id)}
                        </span>
                        <span style={styles.itemQty}>×{item.quantity}</span>
                        <span style={styles.itemPrice}>
                          {formatCurrency((item.unit_price || item.price || 0) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => handleCreateOrder(config)}
                    style={{...styles.btn, ...styles.btnPrimary, width: '100%', marginTop: '16px'}}
                    className="btn"
                    disabled={creatingOrder}
                  >
                    {creatingOrder ? 'Creating Order...' : 'Create Order'}
                  </button>
                </div>
              )
            })}
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
  formSection: {
    background: 'white',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    marginBottom: '32px',
    border: '1px solid rgba(0,0,0,0.04)',
    position: 'relative',
    zIndex: 1,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  },
  formGroup: {
    marginBottom: '0',
  },
  formLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#888',
    marginBottom: '8px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  formInput: {
    width: '100%',
    padding: '14px 16px',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '10px',
    fontSize: '14px',
    fontFamily: '"Questrial", sans-serif',
    transition: 'all 0.3s ease',
    background: 'white',
  },
  errorCard: {
    background: '#FFEBEE',
    color: '#c62828',
    padding: '16px 24px',
    borderRadius: '12px',
    marginTop: '20px',
    border: '1px solid #ef9a9a',
  },
  btn: {
    padding: '14px 28px',
    borderRadius: '10px',
    fontSize: '14px',
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
  loadingState: {
    textAlign: 'center',
    padding: '40px',
    background: 'white',
    borderRadius: '20px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },
  rulesCard: {
    background: 'linear-gradient(135deg, #fff5f5 0%, #fff 100%)',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    marginBottom: '32px',
    border: '1px solid rgba(232,180,184,0.2)',
    position: 'relative',
    zIndex: 1,
  },
  rulesTitle: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '24px',
    fontWeight: '500',
    margin: '0 0 24px 0',
    color: '#1a1a1a',
  },
  rulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  },
  ruleItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'white',
    borderRadius: '10px',
  },
  ruleLabel: {
    fontSize: '13px',
    color: '#888',
  },
  ruleValue: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#1a1a1a',
    fontFamily: '"Cormorant Garamond", serif',
  },
  section: {
    position: 'relative',
    zIndex: 1,
  },
  sectionTitle: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
    margin: '0 0 24px 0',
    color: '#1a1a1a',
  },
  configsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
  },
  configCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    transition: 'all 0.3s ease',
    border: '1px solid rgba(0,0,0,0.04)',
    animation: 'fadeIn 0.6s ease-out forwards',
    opacity: 0,
  },
  configHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  configNumber: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '20px',
    fontWeight: '500',
    margin: 0,
    color: '#1a1a1a',
  },
  configTotal: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '20px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  configItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  configItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#faf8f8',
    borderRadius: '10px',
  },
  itemName: {
    flex: 1,
    fontSize: '14px',
    color: '#1a1a1a',
  },
  itemQty: {
    fontSize: '13px',
    color: '#888',
    marginRight: '12px',
  },
  itemPrice: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a1a1a',
    minWidth: '80px',
    textAlign: 'right',
  },
}

export default BouquetBuilder
