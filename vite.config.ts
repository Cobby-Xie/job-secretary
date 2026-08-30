import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist-ui',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    watch: {
      ignored: ['**/.cache/**', '**/dist-ui/**', '**/dist-desktop/**', '**/release/**', '**/release-beta/**'],
    },
  },
});
