import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export default defineConfig(({ mode }) => {
  const neonRealtimeUrl = loadEnv(mode, projectRoot, '').NEON_REALTIME_URL || process.env.NEON_REALTIME_URL || ''

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_NEON_REALTIME_URL': JSON.stringify(neonRealtimeUrl),
    },
  }
})
