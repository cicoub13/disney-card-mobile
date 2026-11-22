import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH est fourni par le workflow GitHub Pages (ex. "/disney-card-mobile/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    // HTTPS en dev : la caméra est refusée en HTTP quand on ouvre le site depuis le téléphone.
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png'],
      manifest: {
        name: 'Album 108 · Cartes Disney Leclerc 2026',
        short_name: 'Album 108',
        description: 'Scanne et suis ta collection de cartes Disney Leclerc',
        lang: 'fr',
        theme_color: '#16206b',
        background_color: '#f4f5fa',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Moteur OCR (worker, wasm, données "eng") téléchargé depuis jsDelivr : on le garde en cache.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Visuels des cartes (collexstash), gardés pour l'usage hors ligne.
            urlPattern: ({ url }) => url.hostname === 'img.collexstash.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
