import { test, expect } from '@playwright/test'

test.describe('UI Project Creation', () => {
  test('creates first project via UI when app is empty', async ({ page }) => {
    test.setTimeout(60_000) // 1 minute should be plenty

    await page.goto('/')

    // Skip tutorial if it appears
    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
    })

    // Wait for loading splash to disappear
    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 30_000 })

    // Skip tutorial button if visible
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // Wait for the "Create New Project" button to appear
    const createButton = page.getByRole('button', { name: /create new project/i })
    await expect(createButton).toBeVisible({ timeout: 10_000 })

    // Click the create button
    await createButton.click()

    // Modal should appear
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Fill in project name
    const projectName = `E2E Test Project ${Date.now()}`
    const nameInput = modal.getByLabel(/project name/i)
    await nameInput.fill(projectName)

    // Click create/save button in modal
    const saveButton = modal.getByRole('button', { name: /(create|save)/i })
    await saveButton.click()

    // Modal should close
    await expect(modal).toBeHidden({ timeout: 5_000 })

    // Project should be selected in dropdown
    const projectSelect = page.locator('select')
    await expect(projectSelect).toHaveValue(/^\d+$/, { timeout: 10_000 })

    // Verify the project name appears in the select
    const selectedOption = projectSelect.locator('option:checked')
    await expect(selectedOption).toContainText(projectName)

    // Should show empty state or file list area
    const fileList = page.locator('[data-component="file-list"]')
    await expect(fileList).toBeVisible({ timeout: 5_000 })

    // Verify no error messages
    const errorMessages = page.getByText(/error|failed|timeout/i)
    await expect(errorMessages).toHaveCount(0)
  })

  test('creates additional project when projects already exist', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/')

    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
    })

    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 30_000 })

    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // Get initial project count
    const projectSelect = page.locator('select')
    await projectSelect.waitFor({ state: 'visible', timeout: 10_000 })

    const initialOptions = await projectSelect.locator('option').count()

    // Click create button
    const createButton = page.getByRole('button', { name: /create new project/i })
    await createButton.click()

    // Fill and submit form
    const modal = page.locator('[role="dialog"]')
    const projectName = `Another Test Project ${Date.now()}`
    await modal.getByLabel(/project name/i).fill(projectName)
    await modal.getByRole('button', { name: /(create|save)/i }).click()

    // Wait for modal to close
    await expect(modal).toBeHidden({ timeout: 5_000 })

    // Verify new project was added
    await expect(projectSelect.locator('option')).toHaveCount(initialOptions + 1, { timeout: 10_000 })

    // Verify new project is selected
    const selectedOption = projectSelect.locator('option:checked')
    await expect(selectedOption).toContainText(projectName)
  })
})
