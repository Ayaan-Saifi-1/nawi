import apiClient from './apiClient.js';

export const getManufacturers = (params) => apiClient.get('/manufacturers', { params });
export const createManufacturer = (data) => apiClient.post('/manufacturers', data);
export const updateManufacturer = (id, data) => apiClient.patch(`/manufacturers/${id}`, data);
export const deleteManufacturer = (id) => apiClient.delete(`/manufacturers/${id}`);
