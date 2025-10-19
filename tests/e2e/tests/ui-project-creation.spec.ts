import { test, expect } from '@playwright/test'

test.describe('UI Project Creation', () => {
  test('creates first project via UI when app is empty', async ({ page }) => {
    test.setTimeout(60_000) // 1 minute should be plenty

    await page.goto('/audio')

    // Skip tutorial if it appears
    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
      window.localStorage.setItem('hasSeenAudioTutorial', 'true')
    })

    // Wait for loading splash to disappear
    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 30_000 })

    // Skip tutorial button if visible
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // Wait for the "Create Audio Project" button to appear (empty state)
    const createButton = page.getByRole('button', { name: /create audio project/i })
    await expect(createButton).toBeVisible({ timeout: 10_000 })

    // Click the create button
    await createButton.click()

    // Modal should appear - wait for "Create New Project" heading
    const modalHeading = page.getByRole('heading', { name: /create new project/i })
    await expect(modalHeading).toBeVisible({ timeout: 5_000 })

    // Fill in project name
    const projectName = `E2E Test Project ${Date.now()}`
    const nameInput = page.getByLabel(/project name/i)
    await nameInput.fill(projectName)

    // Click create button in modal
    const saveButton = page.getByRole('button', { name: /^create$/i })
    await saveButton.click()

    // Modal should close
    await expect(modalHeading).toBeHidden({ timeout: 5_000 })

    // Project should be selected in dropdown (use specific selector to avoid language dropdown)
    const projectSelect = page.getByRole('banner').getByRole('combobox')
    await expect(projectSelect).toHaveValue(/^\d+$/, { timeout: 10_000 })

    // Verify the project name appears in the select
    const selectedOption = projectSelect.locator('option:checked')
    await expect(selectedOption).toContainText(projectName)

    // Should show the upload section (project is selected and ready)
    const uploadHeading = page.getByRole('heading', { name: /upload audio/i })
    await expect(uploadHeading).toBeVisible({ timeout: 5_000 })

    // Verify no error messages
    const errorMessages = page.getByText(/error|failed|timeout/i)
    await expect(errorMessages).toHaveCount(0)
  })

  test('creates additional project when projects already exist', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/audio')

    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
      window.localStorage.setItem('hasSeenAudioTutorial', 'true')
    })

    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 30_000 })

    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // Get initial project count (use specific selector to avoid language dropdown)
    const projectSelect = page.getByRole('banner').getByRole('combobox')
    await projectSelect.waitFor({ state: 'visible', timeout: 10_000 })

    const initialOptions = await projectSelect.locator('option').count()

    // Click create button
    const createButton = page.getByRole('button', { name: /new project/i })
    await createButton.click()

    // Wait for modal to appear
    const modalHeading = page.getByRole('heading', { name: /create new project/i })
    await expect(modalHeading).toBeVisible({ timeout: 5_000 })

    // Fill and submit form
    const projectName = `Another Test Project ${Date.now()}`
    await page.getByLabel(/project name/i).fill(projectName)
    await page.getByRole('button', { name: /^create$/i }).click()

    // Wait for modal to close
    await expect(modalHeading).toBeHidden({ timeout: 5_000 })

    // Verify new project was added
    // Verify new project was added (count should increase)
    const newOptions = await projectSelect.locator('option').count()
    expect(newOptions).toBeGreaterThanOrEqual(initialOptions + 1)

    // Verify new project is selected
    const selectedOption = projectSelect.locator('option:checked')
    await expect(selectedOption).toContainText(projectName)
  })
})
