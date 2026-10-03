import apiClient from './apiClient.js';

export const generateReport = (sessionId, remarks) => apiClient.post(`/reports/${sessionId}/generate`, { remarks });
export const getReportById = (id) => apiClient.get(`/reports/${id}`);
export const revokeReport = (id, reason) => apiClient.post(`/reports/${id}/revoke`, { reason });
export const publishReport = (id) => apiClient.post(`/reports/${id}/publish`);
export const archiveReport = (id, reason) => apiClient.post(`/reports/${id}/archive`, { reason });
export const verifyReport = (query) => apiClient.get(`/verify/${query}`, { skipErrorToast: true });
export const lookupPublicReportsBySerialNumber = (serialNumber) =>
  apiClient.get('/verify/lookup', { params: { serialNumber }, skipErrorToast: true });
export const lookupPublicReportsByInstrumentDetails = (searchTerm, testYear) =>
  apiClient.get('/verify/lookup-details', {
    params: { searchTerm, ...(testYear ? { testYear } : {}) },
    skipErrorToast: true,
  });
