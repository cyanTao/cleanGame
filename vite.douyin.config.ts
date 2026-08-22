import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'douyin',
    lib: {
      entry: 'src/douyin-entry.ts',
      formats: ['es'],
      fileName: () => 'game.js'
    },
    target: 'es2018',
    minify: true,
    emptyOutDir: false
  }
})