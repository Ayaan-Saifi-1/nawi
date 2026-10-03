import apiClient from './apiClient.js';

export const getUsers = (params) => apiClient.get('/users', { params });
export const createUser = (data) => apiClient.post('/users', data);
export const updateUser = (id, data) => apiClient.patch(`/users/${id}`, data);