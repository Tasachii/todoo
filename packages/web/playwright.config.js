import { defineConfig } from '@playwright/test'

// E2E smoke suite: drives the real server (in-memory DB) serving the real
// production build in headless Chromium. Run `npm run build` first.
export default defineConfig({
  testDir: './e2e',
  workers: 1, // tests share one in-memory database
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4527',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'node ../server/src/index.js',
    url: 'http://127.0.0.1:4527/api/health',
    reuseExistingServer: false,
    env: { TODOO_PORT: '4527', TODOO_DB: ':memory:', TODOO_HOST: '127.0.0.1' },
  },
})
