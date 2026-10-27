import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// One config builds all three Electron contexts: main (Node), preload (bridge),
// and renderer (Chromium). The renderer has two pages, one per window.
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          companion: resolve(__dirname, 'src/renderer/companion/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html')
        }
      }
    }
  }
})
