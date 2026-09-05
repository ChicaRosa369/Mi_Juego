import { defineConfig } from 'vite';

const publicBuildBase = 'https://cdn.jsdelivr.net/gh/ChicaRosa369/Mi_Juego@arena%2F01a071fc-mi-juego/docs/';

export default defineConfig(({ command }) => ({
  // La build pública carga sus recursos desde el CDN; así el visor web puede ejecutar
  // el juego aunque el HTML de GitHub se abra a través de un proxy de previsualización.
  base: command === 'build' ? publicBuildBase : '/',
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
