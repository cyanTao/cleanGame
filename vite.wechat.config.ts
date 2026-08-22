import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'wechat',
    lib: {
      entry: 'src/minigame-entry.ts',
      formats: ['es'],
      fileName: () => 'game.js'
    },
    target: 'es2018',
    minify: true,
    emptyOutDir: false
  }
})