import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import '../../styles/components.css'

const Layout = () => {
  return (
    <div className="layout">
      <header className="layout-header">
        <Navbar />
      </header>
      <main className="layout-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout

