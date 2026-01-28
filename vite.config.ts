import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Capacitor native app - no PWA needed
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/',
})
