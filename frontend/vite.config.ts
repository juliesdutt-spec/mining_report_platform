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
    // recharts is ~540 kB and cannot be split further. It used to have its own
    // manualChunk, which read like isolation and was the opposite: the chunk
    // took recharts' shared transitive dependencies with it, so all nine page
    // chunks imported it and whichever screen you opened first pulled the lot.
    // Measured on a 400 kbps connection that was 151 kB over the wire and 6.2s
    // of the critical path, on the sign-in screen. Left to Rollup it lands in
    // the AnalyticsPage chunk, which is the only page that draws a chart and is
    // already imported lazily. scripts/bundle-audit.mjs walks the built output
    // and fails if it ever creeps back onto the first load.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // React is genuinely needed to render anything, so a chunk of its own
        // means an app change does not invalidate it in the browser cache.
        // Nothing else belongs here: a manualChunk pulls in everything the
        // named module imports, which is how recharts ended up on every page.
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});