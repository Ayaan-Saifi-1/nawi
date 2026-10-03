import apiClient from './apiClient.js';

export const getAuditLogs = (params) => apiClient.get('/audit-log', { params });
export const verifyAuditIntegrity = () => apiClient.get('/audit-log/integrity');
export const getDashboardStats = () => apiClient.get('/dashboard/stats');
export const getExportData = (params) => apiClient.get('/export/legal-metrology', { params });
export const getDemoStatus = () => apiClient.get('/demo/status');
export const seedDemoData = () => apiClient.post('/demo/seed');
export const clearDemoData = () => apiClient.post('/demo/clear');
