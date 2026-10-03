import apiClient from './apiClient.js';

export const getTestSessions = (params) => apiClient.get('/test-sessions', { params });
export const getTestSessionById = (id) => apiClient.get(`/test-sessions/${id}`);
export const createTestSession = (data) => apiClient.post('/test-sessions', data);
export const addObservations = (sessionId, data) => apiClient.post(`/test-sessions/${sessionId}/observations`, { observations: Array.isArray(data) ? data : [data] });
export const submitSession = (sessionId) => apiClient.post(`/test-sessions/${sessionId}/submit`);
export const approveSession = (sessionId) => apiClient.post(`/test-sessions/${sessionId}/approve`);
export const rejectSession = (sessionId, reason) => apiClient.post(`/test-sessions/${sessionId}/reject`, { reason });
export const updateObservation = (sessionId, obsId, data) => apiClient.patch(`/test-sessions/${sessionId}/observations/${obsId}`, data);
export const deleteObservation = (sessionId, obsId) => apiClient.delete(`/test-sessions/${sessionId}/observations/${obsId}`);
export const updateTestSession = (sessionId, data) => apiClient.patch(`/test-sessions/${sessionId}`, data);
export const acknowledgeFlag = (sessionId, obsId, payload) => apiClient.post(`/test-sessions/${sessionId}/observations/${obsId}/acknowledge-flag`, payload);
