import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const scriptsRoot = path.resolve(__dirname, 'scripts')
const runStackScript = path.join(scriptsRoot, 'run-local-stack.js')

// Detect if running with real Whisper (no stub)
const useRealWhisper = process.env.USE_TRANSCRIPTION_STUB === '0'

export default defineConfig({
  testDir: './tests',
  // Real Whisper needs longer timeouts (each transcription takes 30-60s)
  timeout: useRealWhisper ? 10 * 60 * 1000 : 5 * 60 * 1000,
  expect: {
    timeout: useRealWhisper ? 3 * 60 * 1000 : 120_000,
  },
  // Real Whisper: run serially (1 worker) to avoid resource contention
  // Stub mode: run in parallel (4 workers) for speed
  workers: useRealWhisper ? 1 : 4,
  use: {
    baseURL: process.env.LOCAL_WEB_URL || 'http://127.0.0.1:18300',
    trace: 'on-first-retry',
    actionTimeout: useRealWhisper ? 3 * 60 * 1000 : 120_000,
  },
  projects: [
    {
      name: 'chromium-local',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer:
    process.env.PW_DISABLE_WEB_SERVER === '1'
      ? undefined
      : {
          command: `node ${runStackScript}`,
          url: process.env.LOCAL_WEB_URL || 'http://127.0.0.1:18300',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
  outputDir: 'test-results/local',
})
