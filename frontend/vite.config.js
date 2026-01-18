import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/keycloak': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/keycloak/, '')
      },
      '/api/auth': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, '')
      },
      '/api/users': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/users/, '')
      },
      '/api/inventory': {
        target: 'http://localhost:5003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/inventory/, '')
      },
      '/api/orders': {
        target: 'http://localhost:5004',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/orders/, '')
      },
      '/api/bouquet': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bouquet/, '')
      },
      '/api/reports': {
        target: 'http://localhost:5007',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/reports/, '')
      }
    }
  }
})

