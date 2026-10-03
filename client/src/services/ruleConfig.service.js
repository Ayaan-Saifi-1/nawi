import apiClient from './apiClient.js';

export const getRuleConfigs = (params) => apiClient.get('/rule-configs', { params });
export const createRuleConfig = (data) => apiClient.post('/rule-configs', data);
export const activateRuleConfig = (id, data) => apiClient.post(`/rule-configs/${id}/activate`, data);
export const sandboxRuleConfig = (id) => apiClient.post(`/rule-configs/${id}/sandbox`);
export const submitRuleReview = (id) => apiClient.post(`/rule-configs/${id}/submit-review`);
export const recordTechnicalReview = (id) => apiClient.post(`/rule-configs/${id}/technical-review`);
export const retireRuleConfig = (id, reason) => apiClient.post(`/rule-configs/${id}/retire`, { reason });