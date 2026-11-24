/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// `--mode https` liga um certificado local autoassinado, para testar a
// instalação no celular pela rede (o service worker só funciona em HTTPS,
// exceto em localhost). Em produção, o HTTPS vem da hospedagem.
export default defineConfig(({ mode }) => ({
  // Vitest: só os testes de unidade em src/. Os de navegador (e2e/) são do Playwright.
  test: { include: ['src/**/*.test.ts'] },
  define: {
    __VERSAO_APP__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  server: {
    // Em desenvolvimento, /api vai para o servidor Express (pasta api/).
    proxy: { '/api': 'http://localhost:3333' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:3333' },
  },
  plugins: [
    react(),
    mode === 'https' && basicSsl(),
    VitePWA({
      // A nova versão não assume sozinha: o app mostra um aviso e o usuário
      // decide quando recarregar (componente AvisoAtualizacao).
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'MOTUS',
        short_name: 'MOTUS',
        description: 'Hábitos e treinos em um só lugar. Disciplina, movimento e evolução.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#090C15',
        theme_color: '#090C15',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        // A API nunca vem do cache: os dados offline ficam no IndexedDB.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Recebe os lembretes (Web Push) e abre o app ao tocar na notificação.
        importScripts: ['/sw-push.js'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
}))
