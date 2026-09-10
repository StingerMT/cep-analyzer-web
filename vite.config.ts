import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig(({ command }) => ({
  // GitHub Pages needs the repo name as the base path in production.
  // Local file:// and USB deployments use relative paths.
  base: command === 'build' ? '/cep-analyzer-web/' : './',
  server: { host: true },
  plugins: [react(), mkcert()],
  build: { assetsInlineLimit: 0, sourcemap: false },
}))
