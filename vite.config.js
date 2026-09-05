import { defineConfig } from 'vite';

const cdnBuildBase = 'https://cdn.jsdelivr.net/gh/ChicaRosa369/Mi_Juego@arena%2F01a071fc-mi-juego/docs/';
const pagesBuildBase = '/Mi_Juego/';

export default defineConfig(({ command, mode }) => ({
  // El modo "pages" genera rutas para el alojamiento oficial de GitHub Pages.
  // El build normal conserva una versión que puede usarse mediante el CDN.
  base: command === 'build' ? (mode === 'pages' ? pagesBuildBase : cdnBuildBase) : '/',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: mode === 'pages' ? 'pages-dist' : 'docs',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
}));
