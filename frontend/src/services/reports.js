/**
 * Reports API Service
 * Fetches reports from read-replica based reports-service
 */
import ApiClient from './api';
import { API_ENDPOINTS } from '../utils/constants';
import { getToken } from './auth';

const client = new ApiClient(API_ENDPOINTS.REPORTS_SERVICE);

/**
 * Get sales summary report
 */
export const getSalesSummary = async (startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  return client.get(`/reports/sales/summary?${params}`);
};

/**
 * Get daily sales breakdown
 */
export const getDailySales = async (startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  return client.get(`/reports/sales/daily?${params}`);
};

/**
 * Get inventory levels report
 */
export const getInventoryLevels = async () => {
  return client.get('/reports/inventory/levels');
};

/**
 * Get low stock items report
 */
export const getLowStock = async (threshold = 10) => {
  return client.get(`/reports/inventory/low-stock?threshold=${threshold}`);
};

/**
 * Get expiring stock report
 */
export const getExpiringStock = async (days = 7) => {
  return client.get(`/reports/inventory/expiring?days=${days}`);
};

/**
 * Get orders by status report
 */
export const getOrdersByStatus = async () => {
  return client.get('/reports/orders/status');
};

/**
 * Get top selling products report
 */
export const getTopProducts = async (limit = 10, startDate, endDate) => {
  const params = new URLSearchParams();
  params.append('limit', limit);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  return client.get(`/reports/orders/top-products?${params}`);
};

/**
 * Get payment status report
 */
export const getPaymentStatus = async () => {
  return client.get('/reports/orders/payment-status');
};

/**
 * Get combined dashboard report
 */
export const getDashboardReport = async () => {
  return client.get('/reports/dashboard');
};

/**
 * Export dashboard report as PDF
 */
export const exportDashboardPDF = async () => {
  const token = getToken();
  const response = await fetch(`${API_ENDPOINTS.REPORTS_SERVICE}/export/dashboard`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to export PDF');
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bloomflow_dashboard_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

/**
 * Export sales report as PDF
 */
export const exportSalesPDF = async (startDate, endDate) => {
  const token = getToken();
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  const response = await fetch(`${API_ENDPOINTS.REPORTS_SERVICE}/export/sales?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to export PDF');
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bloomflow_sales_${startDate || 'report'}_${endDate || ''}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

/**
 * Export inventory report as PDF
 */
export const exportInventoryPDF = async () => {
  const token = getToken();
  const response = await fetch(`${API_ENDPOINTS.REPORTS_SERVICE}/export/inventory`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to export PDF');
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bloomflow_inventory_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

/**
 * Export orders report as PDF
 */
export const exportOrdersPDF = async (startDate, endDate) => {
  const token = getToken();
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  const response = await fetch(`${API_ENDPOINTS.REPORTS_SERVICE}/export/orders?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to export PDF');
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bloomflow_orders_${startDate || 'report'}_${endDate || ''}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};
