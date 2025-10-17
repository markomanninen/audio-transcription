import { test, expect } from '@playwright/test'

test.describe('Dashboard Ready State', () => {
  test('shows seeded file list once backend is ready', async ({ page }) => {
    await page.goto('/')

    // Ensure the tutorial does not block the UI under test
    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
    })

    // Wait for the loading splash to disappear (the area failing in other suites)
    await page.waitForSelector('[data-testid="loading-splash"]', {
      state: 'detached',
      timeout: 180_000,
    })

    // Once the splash is gone we must see the seeded file list
    await page.waitForSelector('[data-component="file-list"]', {
      timeout: 15_000,
    })

    const fileCards = page.locator('[data-component="file-card"]')
    const cardCount = await fileCards.count()
    expect(cardCount).toBeGreaterThan(0)
  })
})
