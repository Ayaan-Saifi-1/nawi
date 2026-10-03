import apiClient from './apiClient.js';

export const uploadAttachment = (sessionId, formData) =>
  apiClient.post(`/test-sessions/${sessionId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getAttachments = (sessionId) =>
  apiClient.get(`/test-sessions/${sessionId}/attachments`);

export const downloadAttachment = (attachmentId) =>
  apiClient.get(`/test-sessions/attachments/${attachmentId}/file`, { responseType: 'blob' });
