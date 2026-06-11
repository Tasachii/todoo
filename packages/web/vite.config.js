import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Non-root base for static hosts that serve under a subpath
  // (e.g. GitHub Pages: VITE_BASE=/todoo/). Defaults to root.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:4521',
    },
  },
})
