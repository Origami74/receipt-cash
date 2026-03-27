import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { imagetools } from 'vite-imagetools';
import fs from 'fs';
import path from 'path';

const label = process.env.VITE_LABEL || 'receipt-cash'
const appName = label === 'sugardaddy-cash' ? 'SugarDaddy.Cash' : 'Receipt.Cash'

export default defineConfig({
  plugins: [
    vue(),
    imagetools({
      exclude: ['public/**/*'],
      defaultDirectives: (url) => {
        const params = new URLSearchParams();
        params.set('format', 'webp');
        params.set('quality', '85');
        return params;
      },
    }),
    {
      name: 'html-title',
      transformIndexHtml: (html) => html.replace(/<title>.*?<\/title>/, `<title>${appName}</title>`)
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['receipt-cash-logo.ico', 'receipt-cash-logo.png', 'robots.txt', 'apple-touch-icon.png', '_redirects'],
      manifest: {
        name: appName,
        short_name: appName,
        description: 'A mobile-first receipt settlement PWA using Nostr and Cashu',
        theme_color: '#FFB54C',
        icons: [
          {
            src: '/receipt-cash-logo.png',
            sizes: '512x512',
            type: 'image/webp'
          },
          {
            src: '/receipt-cash-logo.png',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => {
              return request.mode === 'navigate';
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigations',
              networkTimeoutSeconds: 3,
              plugins: [
                {
                  cacheWillUpdate: async ({ response }) => {
                    // Don't cache redirected responses to avoid the redirect mode error
                    return response.redirected ? null : response;
                  },
                  cacheKeyWillBeUsed: async ({ request }) => {
                    // Always return the same cache key for navigation requests
                    return new URL('/', location.origin).href;
                  }
                }
              ]
            }
          }
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/]
      }
    })
  ],
  resolve: {
    extensions: ['.js', '.ts', '.vue', '.json']
  },
  optimizeDeps: {
    include: ['@scure/bip39', 'coco-cashu-core', 'coco-cashu-indexeddb']
  },
  server: {
    host: true,
    port: 3000,
    https: process.env.VITE_USE_HTTPS === 'true' ? {
      key: fs.readFileSync('certs/key.pem'),
      cert: fs.readFileSync('certs/cert.pem'),
    } : false
  }
});