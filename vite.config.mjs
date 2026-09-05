import { defineConfig } from 'vite';

/* Relatieve base zodat de build ook vanuit een subdirectory werkt
   (GitHub Pages serveert onder /Spelletje/). */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets-build',
    target: 'es2020'
  }
});
