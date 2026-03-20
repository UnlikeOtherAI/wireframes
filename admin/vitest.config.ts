import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@wireframes/renderer': resolve(__dirname, '../renderer/src/index.ts'),
    },
  },
  test: {
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['e2e/**'],
  },
})
