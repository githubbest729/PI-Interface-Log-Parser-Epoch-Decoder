import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // >>> SET THIS TO YOUR GITHUB REPOSITORY NAME, with leading and trailing slash. <
  // Example: repo "pi-log-parser" -> base: '/pi-log-parser/'
  // Use '/' only for a custom domain or a <username>.github.io user site.
  base: '/githubbest729/',
  plugins: [react(), tailwindcss()],
})
