import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/web/',
  server: {
    host: true,
    port: 7777,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true
      },
      '/users': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true
      },
      '/projects': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true
      },
      '/testcases': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true
      },
      '/testruns': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true
      },
      '/defects': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true
      },
      '/notifications': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true
      },
      '/categories': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true
      }
    }
  },
  plugins: [react()]
})