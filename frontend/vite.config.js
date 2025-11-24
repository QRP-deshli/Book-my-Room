import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,   // <- tu nastavíš port podľa potreby
    strictPort: true  // ak je port obsadený, Vite padne namiesto toho, aby hľadal iný
  }
})
