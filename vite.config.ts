import { defineConfig } from 'vite';

// Project site: https://mastercyril.github.io/destinys-world-playcanvas/
export default defineConfig({
  base: '/destinys-world-playcanvas/',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
