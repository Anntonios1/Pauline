import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function requestLogger() {
  return {
    name: 'request-logger',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const startedAt = Date.now()
        res.on('finish', () => {
          console.log(`[frontend] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - startedAt}ms`)
        })
        next()
      })
    },
  }
}

function proxyLogger(name) {
  return {
    configure(proxy) {
      proxy.on('proxyReq', (_proxyReq, req) => {
        console.log(`[proxy:${name}] ${req.method} ${req.url}`)
      })
      proxy.on('proxyReqWs', (_proxyReq, req) => {
        console.log(`[proxy:${name}] WebSocket ${req.url}`)
      })
      proxy.on('proxyRes', (proxyRes, req) => {
        console.log(`[proxy:${name}] ${req.method} ${req.url} ${proxyRes.statusCode}`)
      })
      proxy.on('error', (error, req) => {
        console.error(`[proxy:${name}] ${req?.method || 'REQUEST'} ${req?.url || ''}: ${error.message}`)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), requestLogger()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ...proxyLogger('api'),
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ...proxyLogger('uploads'),
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
        ...proxyLogger('ws'),
      }
    }
  }
})
