import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/PI-Interface-Log-Parser-Epoch-Decoder/',
  plugins: [react(), tailwindcss()],
})
