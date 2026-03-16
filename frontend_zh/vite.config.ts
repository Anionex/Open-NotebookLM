import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://localhost:8213'

  return {
    plugins: [react()],
    server: {
      port: 3001,
      open: false,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/outputs': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
