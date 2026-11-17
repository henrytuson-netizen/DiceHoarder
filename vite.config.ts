import { defineConfig } from 'vite';

// base './' lets the built site work from any path (root or a sub-folder).
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
