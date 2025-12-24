import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
)

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  // Always deploy to VPS with root path
  base: '/',
  // Inject version as environment variable
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  },
  // Proxy API requests to backend server in development
  server: {
    port: 5111,
    proxy: {
      '/api': {
        target: 'http://localhost:3111',
        changeOrigin: true,
      },
      '/pptx-media': {
        target: 'http://localhost:3111',
        changeOrigin: true,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    pool: 'threads',
  }
}))
