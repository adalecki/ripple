import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: "/ripple/",
  plugins: [react()],
  server: {port: 3000},
  build: {
    rollupOptions: {
      // Tell Vite to treat these modules as external and not bundle them
      external: [
        'canvg',
        'dompurify',
        'core-js', // Add any other optional dependencies you are not using
      ],
    },
  }
})
