import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: "/ripple/",
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', {
            runtimeModule: 'react-compiler-runtime'
          }],
        ],
      },
    }),
  ],
  server: { port: 3000 },
  build: {
    rollupOptions: {
      external: [
        'canvg',
        'dompurify',
        'core-js'
      ],
    },
  }
})
