import React, { useState } from 'react'
import FlowerList from './FlowerList'
import LotList from './LotList'
import '../../styles/components.css'

const Inventory = () => {
  const [activeTab, setActiveTab] = useState('flowers')

  return (
    <div>
      <h1>Inventory Management</h1>
      
      <div style={{ marginBottom: '1.5rem', borderBottom: '2px solid var(--color-accent-light)' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('flowers')}
            className={activeTab === 'flowers' ? 'btn btn-primary' : 'btn btn-outline'}
            style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}
          >
            Flowers
          </button>
          <button
            onClick={() => setActiveTab('lots')}
            className={activeTab === 'lots' ? 'btn btn-primary' : 'btn btn-outline'}
            style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}
          >
            Lots
          </button>
        </div>
      </div>

      {activeTab === 'flowers' && <FlowerList />}
      {activeTab === 'lots' && <LotList />}
    </div>
  )
}

export default Inventory

