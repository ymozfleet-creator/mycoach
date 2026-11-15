import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  build: { outDir: '../app', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      workbox: {
        // 画面（HTML）は常にネットワーク優先で最新を取得。ファイル名にハッシュが付くJS/CSSだけを事前保存する
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,svg,png}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          { urlPattern: ({ request }) => request.mode === 'navigate', handler: 'NetworkFirst', options: { cacheName: 'pages', networkTimeoutSeconds: 3 } },
        ],
      },
      manifest: {
        name: 'MyCOACH-MyTEAM',
        short_name: 'MyTEAM',
        description: '部活動・地域クラブの予定・出欠・安全管理・会費をスマホひとつで',
        theme_color: '#0F2A4A',
        background_color: '#F5F7FB',
        display: 'standalone',
        start_url: './',
        lang: 'ja',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
