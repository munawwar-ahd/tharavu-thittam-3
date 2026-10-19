
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import fs from 'fs'
import type { Plugin } from 'vite'

function serveFramesPlugin(): Plugin {
  const framesDir = path.resolve(import.meta.dirname, '..', 'Frames')

  return {
    name: 'serve-frames',
    configureServer(server) {
      server.middlewares.use('/Frames', (req, res, next) => {
        const filePath = path.join(framesDir, req.url ?? '')
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'image/jpeg')
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiTarget =
    env.VITE_API_URL?.trim().replace(/\/+$/, '') || 'http://127.0.0.1:8000'

  return {
    base: '/tharavu-thittam-3/',
    plugins: [
      react(),
      serveFramesPlugin(),
      {
        name: 'copy-frames-for-production',
        closeBundle() {
          const source = path.resolve(import.meta.dirname, '..', 'Frames')
          const destination = path.resolve(import.meta.dirname, 'dist', 'Frames')
          fs.cpSync(source, destination, { recursive: true })
        },
      },
    ],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      open: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, ''),
        },
        '/status': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/ocr': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
