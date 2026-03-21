import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, __dirname, ''),
    ...loadEnv(mode, resolve(__dirname, '..'), ''),
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@wireframes/renderer': resolve(__dirname, '../renderer/bundle/wireframe-renderer.min.js'),
      },
    },
    optimizeDeps: {
      exclude: ['@wireframes/renderer'],
    },
    server: {
      watch: {
        usePolling: true,
        interval: 300,
      },
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: env.VITE_API_URL || 'http://localhost:3000',
          ws: true,
        },
      },
    },
  }
})
