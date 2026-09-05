import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  /* Support asks people to quote a build id, so it has to be in the bundle.
     Inlined at build time rather than fetched — a stale cached bundle would
     otherwise report whatever the server says is current, which is exactly
     the case the id exists to catch. */
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
