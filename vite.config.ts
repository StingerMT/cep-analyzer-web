import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig(({ command }) => ({
  // GitHub Pages needs the repo name as the base path in production.
  // Local file:// and USB deployments use relative paths.
  base: command === 'build' ? '/cep-analyzer-web/' : './',
  server: { host: true },
  // mkcert only runs in dev — it generates local HTTPS certs for camera API.
  // Never runs during `vite build` so CI doesn't try to create certificates.
  plugins: command === 'build' ? [react()] : [react(), mkcert()],
  build: { assetsInlineLimit: 0, sourcemap: false },
}))
