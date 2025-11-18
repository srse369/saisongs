import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  // Use base path based on deployment target
  // For VPS deployment: use root path '/'
  // For GitHub Pages: use '/songstudio/'
  // Set via environment variable: VITE_DEPLOY_TARGET=vps or github
  base: process.env.VITE_DEPLOY_TARGET === 'vps' || mode === 'vps' 
    ? '/' 
    : (command === 'build' ? '/songstudio/' : '/'),
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
