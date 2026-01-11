// API Endpoints
export const API_ENDPOINTS = {
  KEYCLOAK: 'http://localhost:8080/realms/bloomflow/protocol/openid-connect/token',
  AUTH_SERVICE: 'http://localhost:5001',
  USER_SERVICE: 'http://localhost:5002',
  INVENTORY_SERVICE: 'http://localhost:5003',
  ORDER_SERVICE: 'http://localhost:5004',
  BOUQUET_SERVICE: 'http://localhost:5005'
}

// Keycloak Configuration
export const KEYCLOAK_CONFIG = {
  CLIENT_ID: 'bloomflow-api',
  REALM: 'bloomflow',
  // Client secret should be set via environment variable
  CLIENT_SECRET: import.meta.env.VITE_KEYCLOAK_CLIENT_SECRET || ''
}

// Color Palette - Pink/Purple Theme
export const COLORS = {
  // Primary - Pink shades
  PRIMARY: '#E91E63',
  PRIMARY_LIGHT: '#F06292',
  PRIMARY_LIGHTER: '#F8BBD0',
  
  // Secondary - Purple shades
  SECONDARY: '#9C27B0',
  SECONDARY_LIGHT: '#BA68C8',
  SECONDARY_LIGHTER: '#CE93D8',
  
  // Accent - Light pink/purple
  ACCENT_LIGHT: '#F3E5F5',
  ACCENT_LIGHTER: '#FCE4EC',
  
  // Text
  TEXT_PRIMARY: '#4A148C',
  TEXT_SECONDARY: '#424242',
  TEXT_LIGHT: '#757575',
  
  // Background
  BACKGROUND: '#FFFFFF',
  BACKGROUND_LIGHT: '#FAFAFA',
  BACKGROUND_GRADIENT: 'linear-gradient(135deg, #FCE4EC 0%, #F3E5F5 100%)',
  
  // Status colors
  SUCCESS: '#4CAF50',
  WARNING: '#FF9800',
  ERROR: '#F44336',
  INFO: '#2196F3'
}

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'bloomflow_access_token',
  USER_INFO: 'bloomflow_user_info'
}

