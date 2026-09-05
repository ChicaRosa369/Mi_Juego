import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Las rutas relativas permiten abrir la build desde un CDN estático o GitHub Pages.
  base: command === 'build' ? './' : '/',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
}));
