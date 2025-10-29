import { test, expect } from '@playwright/test'

test.describe('Consecutive Project Creation', () => {
  test('creates multiple projects in sequence without backend hanging', async ({ page }) => {
    test.setTimeout(120_000) // 2 minutes

    console.log('=== Testing Consecutive Project Creation ===')

    await page.goto('/audio')

    // Skip tutorial
    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
      window.localStorage.setItem('hasSeenAudioTutorial', 'true')
    })

    // Wait for loading splash
    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 30_000 })

    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // Create 5 projects consecutively
    const projectCount = 5
    const projectNames: string[] = []

    for (let i = 1; i <= projectCount; i++) {
      console.log(`\n[Project ${i}/${projectCount}] Starting creation`)

      const projectName = `Test Project ${i} - ${Date.now()}`
      projectNames.push(projectName)

      // Click create button (use first match since there may be multiple project type buttons)
      const createButton = page.getByRole('button', { name: /new project/i })
      await expect(createButton).toBeVisible({ timeout: 10_000 })
      await createButton.click()

      // Fill form
      const modalHeading = page.getByRole('heading', { name: /create new project/i })
      await expect(modalHeading).toBeVisible({ timeout: 5_000 })

      const nameInput = page.getByLabel(/project name/i)
      await nameInput.fill(projectName)

      const saveButton = page.getByRole('button', { name: /^create$/i })
      await saveButton.click()
      console.log(`[Project ${i}/${projectCount}] Submitted creation request`)

      // Wait for modal to close - this proves the backend responded
      await expect(modalHeading).toBeHidden({ timeout: 15_000 })
      console.log(`[Project ${i}/${projectCount}] [PASS] Created successfully`)

      // Verify project appears in dropdown
      const projectSelect = page.getByRole('banner').getByRole('combobox')
      const selectedOption = projectSelect.locator('option:checked')
      await expect(selectedOption).toContainText(projectName)

      // Small delay between creations to mimic real usage
      await page.waitForTimeout(500)
    }

    // Verify all projects are in the dropdown
    const projectSelect = page.getByRole('banner').getByRole('combobox')
    const allOptions = await projectSelect.locator('option').allTextContents()

    console.log(`\n=== Final Verification ===`)
    console.log(`Total projects in dropdown: ${allOptions.length}`)

    for (const projectName of projectNames) {
      const found = allOptions.some(option => option.includes(projectName))
      expect(found).toBeTruthy()
      console.log(`[PASS] Found: ${projectName}`)
    }

    // Final health check - ensure backend is still responsive
    const healthCheckStart = Date.now()
    const healthCheckButton = page.getByRole('button', { name: /new project/i })
    await expect(healthCheckButton).toBeVisible({ timeout: 5_000 })
    const healthCheckDuration = Date.now() - healthCheckStart
    console.log(`\n[PASS] Backend still responsive after ${projectCount} projects (${healthCheckDuration}ms)`)

    console.log('=== SUCCESS: All consecutive project creations completed ===')
  })

  test('creates project, refreshes page, creates another project', async ({ page }) => {
    test.setTimeout(90_000) // 1.5 minutes

    console.log('=== Testing Project Creation After Page Refresh ===')

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

    // Create first project
    console.log('\n[Step 1] Creating first project')
    const createButton = page.getByRole('button', { name: /new project/i })
    await createButton.click()

    const projectName1 = `Before Refresh ${Date.now()}`
    await page.getByLabel(/project name/i).fill(projectName1)
    await page.getByRole('button', { name: /^create$/i }).click()

    const modalHeading = page.getByRole('heading', { name: /create new project/i })
    await expect(modalHeading).toBeHidden({ timeout: 15_000 })
    console.log('[Step 1] [PASS] First project created')

    // Refresh page
    console.log('\n[Step 2] Refreshing page')
    await page.reload()
    await splash.waitFor({ state: 'detached', timeout: 30_000 })
    console.log('[Step 2] [PASS] Page reloaded')

    // Create second project after refresh
    console.log('\n[Step 3] Creating second project after refresh')
    const createButton2 = page.getByRole('button', { name: /new project/i })
    await expect(createButton2).toBeVisible({ timeout: 10_000 })
    await createButton2.click()

    const projectName2 = `After Refresh ${Date.now()}`
    await page.getByLabel(/project name/i).fill(projectName2)
    await page.getByRole('button', { name: /^create$/i }).click()

    const modalHeading2 = page.getByRole('heading', { name: /create new project/i })
    await expect(modalHeading2).toBeHidden({ timeout: 15_000 })
    console.log('[Step 3] [PASS] Second project created after refresh')

    console.log('=== SUCCESS: Project creation works after page refresh ===')
  })
})
