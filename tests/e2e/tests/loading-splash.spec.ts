import { test, expect } from '@playwright/test'

test.describe('Loading splash behaviour', () => {
  test('splash screen hides when backend is ready', async ({ page }) => {
    await page.goto('/audio')

    const splash = page.getByTestId('loading-splash')

    // Wait for the splash to appear (it should attach while Whisper initializes).
    await splash.waitFor({ state: 'attached', timeout: 120_000 }).catch(() => {})

    // Once the backend flips to ready, the splash must disappear entirely.
    await splash.waitFor({ state: 'detached', timeout: 180_000 })

    // The main dashboard heading should now be visible to the user.
    await expect(page.getByRole('heading', { name: /audio transcription studio/i }).first()).toBeVisible()
  })
})
