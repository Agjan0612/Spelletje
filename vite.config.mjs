import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* Relatieve base zodat de build ook vanuit een subdirectory werkt
   (GitHub Pages serveert onder /Spelletje/).

   Twee spellen, één build. Dorp tot Stad staat op de wortel, het apotheekspel
   in /apotheek/ — allebei met een eigen entry en een eigen bundel, zodat het
   ene spel niet kan breken door een wijziging in het andere. */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets-build',
    target: 'es2020',
    rollupOptions: {
      input: {
        dorp: resolve(__dirname, 'index.html'),
        apotheek: resolve(__dirname, 'apotheek/index.html')
      }
    }
  }
});
