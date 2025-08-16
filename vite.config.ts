import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // necessário para Electron carregar assets via file:// sem paths absolutos
  plugins: [react()],
})
