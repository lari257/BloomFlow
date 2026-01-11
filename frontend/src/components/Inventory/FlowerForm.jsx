import React, { useState, useEffect } from 'react'
import { createFlower, updateFlower } from '../../services/inventory'
import '../../styles/components.css'

const FlowerForm = ({ flower, onClose, inModal = false }) => {
  const [formData, setFormData] = useState({
    name: '',
    color: '',
    seasonality: 'all',
    price_per_unit: '',
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (flower) {
      setFormData({
        name: flower.name || '',
        color: flower.color || '',
        seasonality: flower.seasonality || 'all',
        price_per_unit: flower.price_per_unit || '',
        description: flower.description || ''
      })
    }
  }, [flower])

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
        price_per_unit: parseFloat(formData.price_per_unit)
      }

      if (flower) {
        await updateFlower(flower.id, data)
      } else {
        await createFlower(data)
      }

      onClose()
    } catch (err) {
      setError(err.message || `Failed to ${flower ? 'update' : 'create'} flower`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={inModal ? '' : 'card'} style={inModal ? {} : { marginBottom: '2rem' }}>
      {!inModal && (
        <div className="card-header">
          <h2 className="card-title">{flower ? 'Edit Flower' : 'Add New Flower'}</h2>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Name *
          </label>
          <input
            id="name"
            type="text"
            name="name"
            className="form-input"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="color">
            Color
          </label>
          <input
            id="color"
            type="text"
            name="color"
            className="form-input"
            value={formData.color}
            onChange={handleChange}
            placeholder="e.g., pink, purple"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="seasonality">
            Seasonality
          </label>
          <select
            id="seasonality"
            name="seasonality"
            className="form-select"
            value={formData.seasonality}
            onChange={handleChange}
          >
            <option value="all">All Seasons</option>
            <option value="spring">Spring</option>
            <option value="summer">Summer</option>
            <option value="autumn">Autumn</option>
            <option value="winter">Winter</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="price_per_unit">
            Price per Unit *
          </label>
          <input
            id="price_per_unit"
            type="number"
            name="price_per_unit"
            className="form-input"
            min="0"
            step="0.01"
            value={formData.price_per_unit}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            className="form-textarea"
            value={formData.description}
            onChange={handleChange}
            rows="3"
          />
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
            {loading ? 'Saving...' : flower ? 'Update' : 'Create'}
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

export default FlowerForm

