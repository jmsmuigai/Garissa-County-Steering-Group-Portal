import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the built portal also works from a sub-path (GitHub Pages, county web server folder)
// manualChunks splits big libraries into separate files that download in parallel and stay cached
// between site updates, so returning visitors only re-download the portal's own code.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:8080' } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('leaflet')) return 'vendor-leaflet'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory') || id.includes('lodash')) return 'vendor-charts'
          if (id.includes('lucide')) return 'vendor-icons'
          return 'vendor-core' // react, router and small helpers together (avoids circular chunks)
        },
      },
    },
  },
})
