import { test, expect } from '@playwright/test'

test.describe('Dashboard Ready State', () => {
  test('shows dashboard ready state once backend is ready', async ({ page }) => {
    await page.goto('/audio')

    // Ensure the tutorial does not block the UI under test
    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
      window.localStorage.setItem('hasSeenAudioTutorial', 'true')
    })

    // Wait for the loading splash to disappear (the area failing in other suites)
    await page.waitForSelector('[data-testid="loading-splash"]', {
      state: 'detached',
      timeout: 180_000,
    })

    // Once the splash is gone, the dashboard should be ready
    // Look for the "New Project" button which indicates the app is functional
    const createButton = page.getByRole('button', { name: /new project/i })
    await expect(createButton).toBeVisible({ timeout: 15_000 })

    // Verify we're on the audio dashboard (not an error page)
    await expect(page.getByRole('heading', { name: /audio transcription studio/i }).first()).toBeVisible()
  })
})
