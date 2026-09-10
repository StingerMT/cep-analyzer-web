import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => ({
  // GitHub Pages needs the repo name as the base path in production.
  // Local file:// and USB deployments use relative paths.
  base: command === 'build' ? '/cep-analyzer-web/' : './',
  server: { host: true },
  // mkcert only runs in dev — generates local HTTPS certs for camera API.
  // VitePWA only runs in build — generates the service worker bundle.
  plugins: command === 'build'
    ? [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          // Cache everything in the dist folder
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico,ttf,woff,woff2,json}'],
            // Don't let the service worker cache bust itself on every deploy —
            // use network-first for the entry point so updates propagate cleanly
            navigateFallback: '/cep-analyzer-web/index.html',
            navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
            runtimeCaching: [
              {
                // Cache all app assets with a cache-first strategy
                urlPattern: /\/cep-analyzer-web\/.*/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'cep-analyzer-assets',
                  expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
                },
              },
            ],
          },
          manifest: {
            name: 'CEP Target Analyzer',
            short_name: 'CEP Analyzer',
            description: 'Offline ballistic target analysis — CEP50, sigma, extreme spread',
            theme_color: '#1e1f22',
            background_color: '#1e1f22',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '/cep-analyzer-web/',
            scope: '/cep-analyzer-web/',
            icons: [
              { src: '/cep-analyzer-web/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
            ],
          },
        }),
      ]
    : [react(), mkcert()],
  build: { assetsInlineLimit: 0, sourcemap: false },
}))
