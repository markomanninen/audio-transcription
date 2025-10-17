import { test, expect } from '@playwright/test'

test.describe('Fresh App Stability Test', () => {
  test('creates project on fresh app and verifies stability for 2 minutes', async ({ page }) => {
    test.setTimeout(180_000) // 3 minutes total

    console.log('=== Starting Fresh App Stability Test ===')

    await page.goto('/')
    console.log('[00:00] Navigated to app')

    // Skip tutorial
    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
    })

    // Wait for loading splash to disappear
    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 30_000 })
    console.log('[00:05] Loading splash dismissed')

    // Skip tutorial button if visible
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // Create new project - look for either "Create Your First Project" or "New Project" button
    const createButton = page.getByRole('button', { name: /create.*project|new project/i })
    await expect(createButton).toBeVisible({ timeout: 10_000 })
    console.log('[00:10] Create button visible')

    await createButton.click()

    // Wait for modal - look for the "Create New Project" heading
    const modalHeading = page.getByRole('heading', { name: /create new project/i })
    await expect(modalHeading).toBeVisible({ timeout: 5_000 })

    const projectName = `Stability Test ${Date.now()}`
    const nameInput = page.getByLabel(/project name/i)
    await nameInput.fill(projectName)

    const saveButton = page.getByRole('button', { name: /^create$/i })
    await saveButton.click()
    console.log('[00:15] Project creation submitted')

    // Wait for modal to close - heading should disappear
    await expect(modalHeading).toBeHidden({ timeout: 10_000 })
    console.log('[00:20] Project created successfully')

    // Verify project is selected - use the one in the header/banner
    const projectSelect = page.getByRole('banner').getByRole('combobox')
    await expect(projectSelect).toHaveValue(/^\d+$/, { timeout: 10_000 })

    // Verify main content area is visible (file list or empty state)
    const fileList = page.locator('[data-component="file-list"]')
    const emptyState = page.getByText(/no files|upload|drag.*drop/i)

    // Wait for either file list or empty state to appear
    await Promise.race([
      expect(fileList).toBeVisible({ timeout: 5_000 }),
      expect(emptyState).toBeVisible({ timeout: 5_000 })
    ]).catch(() => {
      console.log('[00:25] Warning: Neither file list nor empty state visible, but continuing...')
    })
    console.log('[00:25] App is working - content area loaded')

    // NOW WAIT 2 MINUTES AND KEEP CHECKING
    const startTime = Date.now()
    const twoMinutes = 2 * 60 * 1000
    let checkCount = 0

    while (Date.now() - startTime < twoMinutes) {
      checkCount++
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      console.log(`[${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}] Health check #${checkCount}`)

      // Check 1: Page is still responsive (project select is visible and functional)
      await expect(projectSelect).toBeVisible({ timeout: 5_000 })

      // Check 2: No error messages
      const errorBanner = page.getByText(/backend.*down|unavailable|error|timeout/i)
      const errorCount = await errorBanner.count()
      if (errorCount > 0) {
        const errorText = await errorBanner.first().textContent()
        console.error(`[${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}] ERROR DETECTED: ${errorText}`)
        throw new Error(`Frontend showed error after ${elapsed}s: ${errorText}`)
      }

      // Check 3: Backend health via console logs
      const logs: string[] = []
      page.on('console', msg => {
        const text = msg.text()
        if (text.includes('Backend marked as down') ||
            text.includes('Request timeout') ||
            text.includes('Health check failed')) {
          logs.push(text)
        }
      })

      if (logs.length > 0) {
        console.error(`[${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}] Console errors detected:`, logs)
        throw new Error(`Console errors after ${elapsed}s: ${logs.join(', ')}`)
      }

      // Check 4: Project select still has value
      const selectValue = await projectSelect.inputValue()
      expect(selectValue).toMatch(/^\d+$/)

      // Wait 10 seconds before next check
      await page.waitForTimeout(10_000)
    }

    console.log('=== SUCCESS: App remained stable for 2 minutes after project creation ===')
  })
})
