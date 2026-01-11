import React, { useState, useEffect } from 'react'
import { getLots, getFlowers, deleteLot, updateLotQuantity } from '../../services/inventory'
import { formatDate, hasRole, hasAnyRole } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'
import LotForm from './LotForm'
import '../../styles/components.css'

const LotList = () => {
  const { getRoles } = useAuth()
  const roles = getRoles()
  const [lots, setLots] = useState([])
  const [flowers, setFlowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingLot, setEditingLot] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFlowerType, setFilterFlowerType] = useState('')
  const isAdmin = hasRole(roles, 'admin')

  useEffect(() => {
    loadData()
  }, [filterStatus, filterFlowerType])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [lotsResponse, flowersResponse] = await Promise.all([
        getLots({
          status: filterStatus || undefined,
          flower_type_id: filterFlowerType || undefined
        }),
        getFlowers()
      ])
      
      setLots(lotsResponse.lots || [])
      setFlowers(flowersResponse.flowers || [])
    } catch (err) {
      setError(err.message || 'Failed to load lots')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (lotId) => {
    if (!confirm('Are you sure you want to delete this lot?')) {
      return
    }

    try {
      await deleteLot(lotId)
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to delete lot')
    }
  }

  const handleEdit = (lot) => {
    setEditingLot(lot)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingLot(null)
    loadData()
  }

  const getFlowerName = (flowerTypeId) => {
    const flower = flowers.find(f => f.id === flowerTypeId)
    return flower ? flower.name : `Flower #${flowerTypeId}`
  }

  const getStatusColor = (status) => {
    const colors = {
      available: 'success',
      reserved: 'warning',
      expired: 'error',
      sold: 'info'
    }
    return colors[status] || 'secondary'
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1>Flower Lots</h1>
        {hasAnyRole(roles, ['admin', 'florar']) && (
          <button
            onClick={() => {
              setEditingLot(null)
              setShowForm(true)
            }}
            className="btn btn-primary"
          >
            Add Lot
          </button>
        )}
      </div>

      {hasAnyRole(roles, ['admin', 'florar']) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Filter by Status</label>
              <select
                className="form-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="expired">Expired</option>
                <option value="sold">Sold</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Filter by Flower Type</label>
              <select
                className="form-select"
                value={filterFlowerType}
                onChange={(e) => setFilterFlowerType(e.target.value)}
              >
                <option value="">All Flowers</option>
                {flowers.map(flower => (
                  <option key={flower.id} value={flower.id}>
                    {flower.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="card" style={{ marginBottom: '1rem', background: '#FFEBEE', color: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      {showForm && (
        <LotForm
          lot={editingLot}
          flowers={flowers}
          onClose={handleFormClose}
        />
      )}

      {lots.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--color-text-light)' }}>
            No lots found
          </p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Flower Type</th>
              <th>Quantity</th>
              <th>Expiry Date</th>
              <th>Status</th>
              {hasAnyRole(roles, ['admin', 'florar']) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {lots.map(lot => (
              <tr key={lot.id}>
                <td>{lot.id}</td>
                <td>{getFlowerName(lot.flower_type_id)}</td>
                <td>{lot.quantity}</td>
                <td>{formatDate(lot.expiry_date)}</td>
                <td>
                  <span className={`badge badge-${getStatusColor(lot.status)}`}>
                    {lot.status}
                  </span>
                </td>
                {hasAnyRole(roles, ['admin', 'florar']) && (
                  <td>
                    <div className="flex" style={{ gap: '0.5rem' }}>
                      <button
                        onClick={() => handleEdit(lot)}
                        className="btn btn-outline"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                      >
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(lot.id)}
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default LotList

