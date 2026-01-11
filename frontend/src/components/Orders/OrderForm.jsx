import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFlowers } from '../../services/inventory'
import { createOrder } from '../../services/orders'
import { formatCurrency } from '../../utils/helpers'
import '../../styles/components.css'

const OrderForm = () => {
  const navigate = useNavigate()
  const [flowers, setFlowers] = useState([])
  const [items, setItems] = useState([{ flower_type_id: '', quantity: 1 }])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadFlowers()
  }, [])

  const loadFlowers = async () => {
    try {
      const response = await getFlowers()
      setFlowers(response.flowers || [])
    } catch (err) {
      setError('Failed to load flowers')
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = () => {
    setItems([...items, { flower_type_id: '', quantity: 1 }])
  }

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = field === 'quantity' ? parseInt(value) || 1 : value
    setItems(newItems)
  }

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      const flower = flowers.find(f => f.id === parseInt(item.flower_type_id))
      if (flower) {
        return total + (flower.price_per_unit * item.quantity)
      }
      return total
    }, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Validate items
    const validItems = items.filter(item => item.flower_type_id && item.quantity > 0)
    if (validItems.length === 0) {
      setError('Please add at least one item to the order')
      setSubmitting(false)
      return
    }

    try {
      const orderData = {
        items: validItems.map(item => ({
          flower_type_id: parseInt(item.flower_type_id),
          quantity: item.quantity
        })),
        notes: notes || undefined
      }

      const response = await createOrder(orderData)
      navigate(`/orders/${response.order.id}`)
    } catch (err) {
      setError(err.message || 'Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }

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
          <h1 style={styles.title}>Create Order</h1>
          <p style={styles.subtitle}>Add items to create a new order</p>
        </div>
      </div>

      {/* Form Section */}
      <div style={styles.formSection}>
        <form onSubmit={handleSubmit}>
          <div style={styles.itemsSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Order Items</h2>
              <button
                type="button"
                onClick={handleAddItem}
                style={styles.addBtn}
                className="btn"
              >
                + Add Item
              </button>
            </div>

            {items.map((item, index) => (
              <div key={index} style={styles.itemCard}>
                <div style={styles.itemHeader}>
                  <span style={styles.itemNumber}>Item {index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      style={styles.removeBtn}
                    >
                      ×
                    </button>
                  )}
                </div>
                
                <div style={styles.itemGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Flower</label>
                    <select
                      style={styles.formInput}
                      value={item.flower_type_id}
                      onChange={(e) => handleItemChange(index, 'flower_type_id', e.target.value)}
                      required
                    >
                      <option value="">Select a flower</option>
                      {flowers.map(flower => (
                        <option key={flower.id} value={flower.id}>
                          {flower.name} - {formatCurrency(flower.price_per_unit)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Quantity</label>
                    <input
                      type="number"
                      style={styles.formInput}
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                {item.flower_type_id && (
                  <div style={styles.itemSubtotal}>
                    {(() => {
                      const flower = flowers.find(f => f.id === parseInt(item.flower_type_id))
                      if (flower) {
                        return `Subtotal: ${formatCurrency(flower.price_per_unit * item.quantity)}`
                      }
                      return null
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={styles.totalSection}>
            <div style={styles.totalLabel}>Total</div>
            <div style={styles.totalAmount}>{formatCurrency(calculateTotal())}</div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel} htmlFor="notes">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              style={styles.formTextarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
              placeholder="Special instructions or notes..."
            />
          </div>

          {error && (
            <div style={styles.errorCard}>
              {error}
            </div>
          )}

          <div style={styles.buttonGroup}>
            <button
              type="submit"
              style={{...styles.btn, ...styles.btnPrimary}}
              className="btn"
              disabled={submitting}
            >
              {submitting ? 'Creating Order...' : 'Create Order'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              style={{...styles.btn, ...styles.btnSecondary}}
              className="btn"
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
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
    border: '1px solid rgba(0,0,0,0.04)',
    position: 'relative',
    zIndex: 1,
  },
  itemsSection: {
    marginBottom: '24px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '24px',
    fontWeight: '500',
    margin: 0,
    color: '#1a1a1a',
  },
  addBtn: {
    padding: '10px 20px',
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
  itemCard: {
    background: '#faf8f8',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  itemNumber: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  removeBtn: {
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
  itemGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '16px',
  },
  formGroup: {
    marginBottom: '20px',
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
  formTextarea: {
    width: '100%',
    padding: '14px 16px',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '10px',
    fontSize: '14px',
    fontFamily: '"Questrial", sans-serif',
    transition: 'all 0.3s ease',
    background: 'white',
    resize: 'vertical',
  },
  itemSubtotal: {
    marginTop: '12px',
    fontSize: '13px',
    color: '#888',
    fontWeight: '500',
  },
  totalSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    background: '#faf8f8',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  totalAmount: {
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: '28px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  errorCard: {
    background: '#FFEBEE',
    color: '#c62828',
    padding: '16px 24px',
    borderRadius: '12px',
    marginBottom: '24px',
    border: '1px solid #ef9a9a',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
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
  btnSecondary: {
    background: '#f5f0f0',
    color: '#1a1a1a',
    border: '1px solid rgba(0,0,0,0.1)',
  },
}

export default OrderForm
