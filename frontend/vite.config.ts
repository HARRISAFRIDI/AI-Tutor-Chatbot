import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward all API calls to FastAPI backend in dev
      '/signup':         'http://localhost:8000',
      '/students':       'http://localhost:8000',
      '/courses':        'http://localhost:8000',
      '/chat':           'http://localhost:8000',
      '/chat-sessions':  'http://localhost:8000',
      '/admin':          'http://localhost:8000',
    },
  },
  build: {
    outDir: 'dist',
  },
})
