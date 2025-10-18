import { Page, expect } from '@playwright/test'

/**
 * Sets up an audio project for testing.
 * Handles navigation, tutorial dismissal, and project creation.
 */
export async function setupAudioProject(page: Page, projectName?: string) {
  await page.goto('/audio')

  // Dismiss tutorials
  await page.evaluate(() => {
    window.localStorage.setItem('hasSeenTutorial', 'true')
    window.localStorage.setItem('hasSeenAudioTutorial', 'true')
  })

  // Wait for loading splash to disappear
  const splash = page.getByTestId('loading-splash')
  await splash.waitFor({ state: 'detached', timeout: 30000 })

  // Skip tutorial button if it appears
  const skipButton = page.getByRole('button', { name: /skip/i })
  if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipButton.click()
  }

  // Create project
  const createButton = page.getByRole('button', { name: /new project/i })
  await expect(createButton).toBeVisible({ timeout: 10000 })
  await createButton.click()

  const name = projectName || `Test Project ${Date.now()}`
  const nameInput = page.getByLabel(/project name/i)
  await nameInput.fill(name)

  const submitButton = page.getByRole('button', { name: /^create$/i })
  await submitButton.click()

  // Wait for modal to close
  const modalHeading = page.getByRole('heading', { name: /create new project/i })
  await expect(modalHeading).toBeHidden({ timeout: 15000 })

  // Verify project is selected in dropdown
  const projectSelect = page.getByRole('banner').getByRole('combobox')
  await expect(projectSelect).toHaveValue(/^\d+$/, { timeout: 10000 })
  const projectId = await projectSelect.inputValue()

  return {
    projectName: name,
    projectId: parseInt(projectId, 10),
  }
}

/**
 * Waits for the audio dashboard to be ready.
 * Use this instead of waiting for file-list which requires a project.
 */
export async function waitForAudioDashboard(page: Page) {
  await page.goto('/audio')

  await page.evaluate(() => {
    window.localStorage.setItem('hasSeenTutorial', 'true')
    window.localStorage.setItem('hasSeenAudioTutorial', 'true')
  })

  const splash = page.getByTestId('loading-splash')
  await splash.waitFor({ state: 'detached', timeout: 30000 })

  const skipButton = page.getByRole('button', { name: /skip/i })
  if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipButton.click()
  }

  // Wait for dashboard heading
  await expect(page.getByRole('heading', { name: /audio transcription studio/i }).first()).toBeVisible({ timeout: 10000 })
}
