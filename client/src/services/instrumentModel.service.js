import apiClient from './apiClient.js';

export const getInstrumentModels = (params) => apiClient.get('/instrument-models', { params });
export const getInstrumentModelById = (id) => apiClient.get(`/instrument-models/${id}`);
export const createInstrumentModel = (data) => apiClient.post('/instrument-models', data);
