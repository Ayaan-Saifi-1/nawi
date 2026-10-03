import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';
import './styles/responsive.css';
import { registerSW } from 'virtual:pwa-register';
import { replayOutbox } from './services/offlineSync.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// vite-plugin-pwa auto-update registration
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New version available. Reload?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
  },
});

// Replay outbox when connectivity resumes
async function replayOfflineOutbox() {
  try {
    if (!navigator.onLine) return;
    const authStore = JSON.parse(localStorage.getItem('nawi_auth') || '{}');
    const token = authStore?.state?.token;
    if (token) {
      const result = await replayOutbox(token);
      window.dispatchEvent(new CustomEvent('nawi:outbox-replayed', { detail: result }));
    }
  } catch (err) {
    console.warn('[OfflineSync] Auto-replay failed:', err.message);
  }
}

window.addEventListener('online', replayOfflineOutbox);
replayOfflineOutbox();
