import React, { useState, useEffect } from 'react'
import { createLot, updateLot } from '../../services/inventory'
import '../../styles/components.css'

const LotForm = ({ lot, flowers, onClose }) => {
  const [formData, setFormData] = useState({
    flower_type_id: '',
    quantity: '',
    expiry_date: '',
    status: 'available'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (lot) {
      setFormData({
        flower_type_id: lot.flower_type_id || '',
        quantity: lot.quantity || '',
        expiry_date: lot.expiry_date ? lot.expiry_date.split('T')[0] : '',
        status: lot.status || 'available'
      })
    }
  }, [lot])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = {
        ...formData,
        flower_type_id: parseInt(formData.flower_type_id),
        quantity: parseInt(formData.quantity)
      }

      if (lot) {
        await updateLot(lot.id, data)
      } else {
        await createLot(data)
      }

      onClose()
    } catch (err) {
      setError(err.message || `Failed to ${lot ? 'update' : 'create'} lot`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div className="card-header">
        <h2 className="card-title">{lot ? 'Edit Lot' : 'Add New Lot'}</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="flower_type_id">
            Flower Type *
          </label>
          <select
            id="flower_type_id"
            name="flower_type_id"
            className="form-select"
            value={formData.flower_type_id}
            onChange={handleChange}
            required
            disabled={!!lot}
          >
            <option value="">Select a flower type</option>
            {flowers.map(flower => (
              <option key={flower.id} value={flower.id}>
                {flower.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="quantity">
            Quantity *
          </label>
          <input
            id="quantity"
            type="number"
            name="quantity"
            className="form-input"
            min="0"
            value={formData.quantity}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="expiry_date">
            Expiry Date *
          </label>
          <input
            id="expiry_date"
            type="date"
            name="expiry_date"
            className="form-input"
            value={formData.expiry_date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            className="form-select"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="expired">Expired</option>
            <option value="sold">Sold</option>
          </select>
        </div>

        {error && (
          <div className="form-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div className="flex" style={{ gap: '1rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : lot ? 'Update' : 'Create'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default LotForm

