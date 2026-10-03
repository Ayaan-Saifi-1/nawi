import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['emblem-india.svg'],
      manifest: {
        short_name: 'NAWI Metrology',
        name: 'NAWI Digital Metrology System',
        icons: [
          {
            src: '/emblem-india.svg',
            type: 'image/svg+xml',
            sizes: '192x192 512x512',
          },
        ],
        start_url: '/',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        description:
          'Digital Metrology Test Report Generation System for NAWI',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/instrument-models/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'instrument-models-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /^\/api\/rule-configs/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'rule-configs-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-dexie': ['dexie'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
