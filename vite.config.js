import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(fileURLToPath(new URL('.', import.meta.url)), 'index.html'),
        app: resolve(fileURLToPath(new URL('.', import.meta.url)), 'app.html'),
        tutorial: resolve(fileURLToPath(new URL('.', import.meta.url)), 'tutorial.html'),
        acknowledgments: resolve(fileURLToPath(new URL('.', import.meta.url)), 'acknowledgments.html')
      },
      output: {
        manualChunks: {
          'maplibre': ['maplibre-gl'],
          'three': ['three'],
          'turf': ['@turf/turf']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  optimizeDeps: {
    include: ['maplibre-gl', 'three', '@turf/turf']
  }
}); 