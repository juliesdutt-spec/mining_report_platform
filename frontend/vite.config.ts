import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { seo } from './plugins/seo';

export default defineConfig({
  plugins: [react(), seo()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // recharts alone is ~540 kB and cannot be split further, but it now sits in
    // its own chunk that only the chart pages pull in. The threshold is raised
    // so the build does not warn about a vendor chunk that is already isolated
    // and lazily loaded — the app chunk itself is ~146 kB.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries out of the app chunk so a
        // code change does not invalidate them in the browser cache.
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});