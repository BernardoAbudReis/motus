import { defineConfig, devices } from '@playwright/test'

/**
 * Testes de ponta a ponta no navegador. Usam o app compilado (`npm run build`)
 * servido pela API real (pasta ../api), com PostgreSQL ligado.
 * Local: `npm run build && npm run e2e`. No GitHub, o workflow faz tudo.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1, // mesmo banco para todos: um teste por vez
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: process.env.PLAYWRIGHT_SAIDA ?? 'test-results',
  use: {
    baseURL: 'http://localhost:3333',
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx tsx --env-file-if-exists=.env src/index.ts',
    cwd: '../api',
    url: 'http://localhost:3333/api/saude',
    reuseExistingServer: !process.env.CI,
    env: { PORT: '3333', AUTH_LIMITE: '1000' },
    timeout: 60_000,
  },
})
