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

  // Wait for project to appear in dropdown and be selected
  const projectSelect = page.getByRole('banner').getByRole('combobox')

  // Wait for the new project to appear as an option in the dropdown
  // Note: Project names in dropdown have prefix like "[PROJECT] Test Project 123"
  await page.waitForFunction(
    (projectName) => {
      const select = document.querySelector('select[class*="block w-full"]') as HTMLSelectElement
      if (!select) {
        console.log('Select element not found')
        return false
      }

      // Check if an option with this project name exists (accounting for emoji prefix)
      const options = Array.from(select.options)
      const projectOption = options.find(opt => {
        const text = opt.textContent || ''
        // Remove prefix and check if it contains our project name
        const cleanText = text.replace(/\[PROJECT\]\s*/, '')
        return cleanText.includes(projectName)
      })

      if (!projectOption) {
        console.log(`Project "${projectName}" not found in ${options.length} options`)
        console.log('Available options:', options.slice(0, 5).map(o => o.textContent))
      }

      return projectOption !== undefined
    },
    name,
    { timeout: 15000 }
  )

  // Now wait for it to be selected (dropdown should have numeric value)
  await page.waitForFunction(
    () => {
      const select = document.querySelector('select[class*="block w-full"]') as HTMLSelectElement
      return select && /^\d+$/.test(select.value)
    },
    { timeout: 15000 }
  )

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
