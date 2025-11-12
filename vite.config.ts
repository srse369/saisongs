import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use base path only for production builds (GitHub Pages)
  // In development, use root path for easier local testing
  base: command === 'build' ? '/songstudio/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    pool: 'threads',
  }
}))
