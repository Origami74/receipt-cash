import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png', '_redirects'],
      manifest: {
        name: 'Sugardad.Cash',
        short_name: 'Sugardad.Cash',
        description: 'A mobile-first receipt settlement PWA using Nostr and Cashu',
        theme_color: '#FFB54C',
        icons: [
          {
            src: 'https://m.primal.net/PxBU.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'https://m.primal.net/PxBU.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 3000,
    https: process.env.VITE_USE_HTTPS === 'true' ? {
      key: fs.readFileSync('certs/key.pem'),
      cert: fs.readFileSync('certs/cert.pem'),
    } : false
  }
}); 