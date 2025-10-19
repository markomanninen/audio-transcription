import { defineConfig, devices } from '@playwright/test'

// Use local dev environment by default, Docker in CI
const isDev = !process.env.CI && !process.env.USE_DOCKER
const baseURL = isDev ? 'http://localhost:5173' : 'http://localhost:3000'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Only auto-start Docker in CI or when explicitly requested
  webServer: process.env.USE_DOCKER || process.env.CI ? {
    command: 'cd ../.. && docker-compose up',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300 * 1000, // 5 minutes
  } : undefined,
})
