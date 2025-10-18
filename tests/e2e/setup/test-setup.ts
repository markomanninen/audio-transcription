import { test as base } from '@playwright/test'

/**
 * E2E Test Setup
 *
 * This file extends the base Playwright test to add custom setup/teardown
 * for E2E tests that interact with the database.
 */

// Type for test fixtures
type TestFixtures = {
  testProject: { id: number; name: string }
}

/**
 * Extended test with custom fixtures
 *
 * Note: Currently, these tests use the development database.
 * For production, we should:
 * 1. Use a separate test database (e.g., test_transcriptions.db)
 * 2. Add database cleanup after each test
 * 3. Add test data seeding utilities
 */
export const test = base.extend<TestFixtures>({
  testProject: async ({ page }, use) => {
    // Setup: Create a test project before each test
    let projectId: number | null = null
    let projectName: string = `Test Project ${Date.now()}`

    try {
      // Navigate to app
      await page.goto('/audio')
      await page.evaluate(() => {
        window.localStorage.setItem('hasSeenTutorial', 'true')
        window.localStorage.setItem('hasSeenAudioTutorial', 'true')
      })

      // Check if we can create a project
      const newProjectButton = page.getByRole('button', { name: /New (Audio )?Project/i })

      if (await newProjectButton.isVisible()) {
        await newProjectButton.click()
        await page.fill('input[name="name"]', projectName)
        await page.getByRole('button', { name: /Create/i }).click()

        // Wait for project to be created
        await page.waitForTimeout(1000)

        // Extract project ID from URL or local storage if needed
        // For now, we'll just track the name
      }

      // Provide the project to the test
      await use({ id: projectId || 1, name: projectName })
    } finally {
      // Teardown: Clean up project after test
      // Note: We skip cleanup for now to avoid deleting data during development
      // In production, add cleanup here:
      // if (projectId) {
      //   await deleteProject(projectId)
      // }
    }
  },
})

export { expect } from '@playwright/test'
