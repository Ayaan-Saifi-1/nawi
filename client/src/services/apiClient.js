import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore.js';
import { useNotificationStore } from '../store/useNotificationStore.js';
import { useLogStore } from '../store/useLogStore.js';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
    : '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() };
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const durationMs = Date.now() - (response.config.metadata?.startTime || Date.now());
    useLogStore.getState().addLog({
      level: 'success',
      type: 'http',
      method: response.config.method?.toUpperCase() || 'GET',
      url: response.config.url || '',
      status: response.status,
      durationMs,
      message: `HTTP ${response.status} OK — ${response.config.url}`,
    });
    return response.data;
  },
  (error) => {
    const durationMs = Date.now() - (error.config?.metadata?.startTime || Date.now());
    const status = error.response?.status || 500;
    const errData = error.response?.data?.error;
    const message = errData?.message || error.message || 'Network error';
    const code = errData?.code || 'NETWORK_ERROR';

    useLogStore.getState().addLog({
      level: status >= 500 ? 'error' : 'warn',
      type: status === 401 || status === 403 ? 'auth' : 'http',
      method: error.config?.method?.toUpperCase() || 'GET',
      url: error.config?.url || '',
      status,
      durationMs,
      message: `${code}: ${message}`,
      details: error.response?.data || error.message,
    });

    const isLoginRequest = error.config?.url?.includes('/auth/login');

    if (status === 401 && !isLoginRequest) {
      useAuthStore.getState().logout();
      useNotificationStore.getState().addToast({ type: 'error', code: 'AUTH_REQUIRED', message: 'Your session has expired. Please sign in again.' });
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') window.location.assign('/login');
    }

    if (status === 403) {
      useNotificationStore.getState().addToast({ type: 'error', code: 'FORBIDDEN', message: 'You do not have permission' });
    } else if (!error.config?.skipErrorToast && status !== 401 && !isLoginRequest) {
      useNotificationStore.getState().addToast({ type: 'error', code, message });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
