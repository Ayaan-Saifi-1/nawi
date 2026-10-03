import { create } from 'zustand';

let logIdCounter = 0;

export const useLogStore = create((set, get) => ({
  logs: [],
  isPaused: false,
  filterLevel: 'all', // 'all' | 'errors' | 'requests' | 'auth'
  searchQuery: '',

  addLog: (logEntry) => {
    if (get().isPaused) return;
    const newLog = {
      id: ++logIdCounter,
      timestamp: new Date().toISOString(),
      level: logEntry.level || 'info', // 'info' | 'warn' | 'error' | 'success'
      type: logEntry.type || 'http', // 'http' | 'auth' | 'system'
      method: logEntry.method || 'GET',
      url: logEntry.url || '',
      status: logEntry.status || 200,
      durationMs: logEntry.durationMs || 0,
      message: logEntry.message || '',
      details: logEntry.details || null,
    };

    set((state) => ({
      logs: [newLog, ...state.logs].slice(0, 500), // keep latest 500 logs
    }));
  },

  clearLogs: () => set({ logs: [] }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setFilterLevel: (level) => set({ filterLevel: level }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
