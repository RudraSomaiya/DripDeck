import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri opens the dev server on a fixed port and rebuilds src-tauri itself.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
})
