import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      manifest: {
        name: 'Gift List',
        short_name: 'GiftList',
        description: 'A secure gift-request PWA for events and individuals.',
        theme_color: '#1a1a2e',
        background_color: '#16213e',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8585',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
