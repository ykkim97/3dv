import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import process from 'node:process'
import fs from 'node:fs/promises'
import path from 'node:path'

const cesiumSource = path.resolve('node_modules/cesium/Build/Cesium')
const cesiumTarget = path.resolve('public/cesium')

const copyCesiumAssets = {
  name: 'copy-cesium-assets',
  async configResolved() {
    await fs.mkdir(cesiumTarget, { recursive: true })
    await Promise.all(['Assets', 'ThirdParty', 'Widgets', 'Workers'].map((directory) =>
      fs.cp(path.join(cesiumSource, directory), path.join(cesiumTarget, directory), { recursive: true })
    ))
  },
}

// https://vite.dev/config/
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), copyCesiumAssets],
  clearScreen: false,
  server: {
    host: host || false,
    port: 5173,
    strictPort: true,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
})
