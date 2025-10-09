import { test, expect } from '@playwright/test'

test.describe('Transcription Restart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Reset circuit breaker if it's tripped
    await page.evaluate(() => {
      if ((window as any).resetCircuitBreaker) {
        (window as any).resetCircuitBreaker()
      }
    })

    // Dismiss tutorial if present
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // Wait for file list to load
    await page.waitForSelector('[data-component="file-list"]', { timeout: 30000 })
  })

  test('Start Over button opens modal for completed file', async ({ page }) => {
    const fileCards = page.locator('[data-component="file-card"]')
    const fileCount = await fileCards.count()

    if (fileCount < 1) {
      test.skip()
      return
    }

    // Find a completed file
    let completedFileFound = false
    for (let i = 0; i < fileCount; i++) {
      const card = fileCards.nth(i)
      const status = await card.getAttribute('data-status')

      if (status === 'completed') {
        await card.click()
        await page.waitForTimeout(1000)

        // Look for Start Over button
        const startOverButton = page.getByRole('button', { name: /start over/i })

        if (await startOverButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          completedFileFound = true

          // Click Start Over
          await startOverButton.click()

          // Modal should open
          const modal = page.locator('[role="dialog"]')
          await expect(modal).toBeVisible({ timeout: 5000 })

          // Should show transcription settings
          const modalTitle = modal.locator('h2, h3')
          await expect(modalTitle.first()).toContainText(/transcription settings/i)

          console.log('✓ Start Over button opened settings modal')
          break
        }
      }
    }

    if (!completedFileFound) {
      console.log('No completed files found with Start Over button')
      test.skip()
    }
  })

  test('force-restart accepts 202 response and queues transcription', async ({ page }) => {
    const fileCards = page.locator('[data-component="file-card"]')
    const fileCount = await fileCards.count()

    if (fileCount < 1) {
      test.skip()
      return
    }

    // Find a completed file
    let completedFileId: string | null = null
    for (let i = 0; i < fileCount; i++) {
      const card = fileCards.nth(i)
      const status = await card.getAttribute('data-status')

      if (status === 'completed') {
        completedFileId = await card.getAttribute('data-file-id')
        await card.click()
        await page.waitForTimeout(1000)
        break
      }
    }

    if (!completedFileId) {
      test.skip()
      return
    }

    // Intercept API calls
    const requests: string[] = []
    const responses: Array<{ status: number; body: any }> = []

    page.on('request', request => {
      if (request.url().includes('force-restart')) {
        requests.push(request.url())
      }
    })

    page.on('response', async response => {
      if (response.url().includes('force-restart')) {
        responses.push({
          status: response.status(),
          body: await response.json().catch(() => null)
        })
      }
    })

    // Click Start Over
    const startOverButton = page.getByRole('button', { name: /start over/i })
    if (!await startOverButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip()
      return
    }

    await startOverButton.click()

    // Wait for modal
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()

    // Click confirm/save button
    const confirmButton = modal.getByRole('button', { name: /(save|start|confirm)/i }).first()
    await confirmButton.click()

    // Wait for API call
    await page.waitForTimeout(2000)

    // Verify force-restart was called
    expect(requests.length).toBeGreaterThan(0)
    console.log(`force-restart called ${requests.length} time(s)`)

    // Check response
    if (responses.length > 0) {
      const lastResponse = responses[responses.length - 1]
      console.log(`Response status: ${lastResponse.status}`)
      console.log(`Response body:`, lastResponse.body)

      // Should accept 202 (queued) or 200 (started immediately)
      expect([200, 202]).toContain(lastResponse.status)

      if (lastResponse.status === 202) {
        expect(lastResponse.body.detail).toContain('model loading')
        console.log('✓ Transcription queued (202) - model loading')
      } else {
        console.log('✓ Transcription started immediately (200)')
      }
    }
  })

  test('Start Over does not cause 500 Internal Server Error', async ({ page }) => {
    const fileCards = page.locator('[data-component="file-card"]')
    const fileCount = await fileCards.count()

    if (fileCount < 1) {
      test.skip()
      return
    }

    // Track console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Track failed API responses
    const failedResponses: Array<{ url: string; status: number; body: any }> = []
    page.on('response', async response => {
      if (response.url().includes('force-restart') && response.status() >= 400) {
        failedResponses.push({
          url: response.url(),
          status: response.status(),
          body: await response.text()
        })
      }
    })

    // Find completed file and try Start Over
    for (let i = 0; i < fileCount; i++) {
      const card = fileCards.nth(i)
      const status = await card.getAttribute('data-status')

      if (status === 'completed') {
        await card.click()
        await page.waitForTimeout(1000)

        const startOverButton = page.getByRole('button', { name: /start over/i })

        if (await startOverButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await startOverButton.click()

          const modal = page.locator('[role="dialog"]')
          if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
            const confirmButton = modal.getByRole('button', { name: /(save|start|confirm)/i }).first()
            await confirmButton.click()
            await page.waitForTimeout(2000)
          }
          break
        }
      }
    }

    // Verify no 500 errors
    const serverErrors = failedResponses.filter(r => r.status >= 500)
    if (serverErrors.length > 0) {
      console.error('Server errors detected:', serverErrors)
    }
    expect(serverErrors).toHaveLength(0)

    // Check for error console logs about failed restart
    const restartErrors = errors.filter(e =>
      e.includes('Failed to restart') ||
      e.includes('500') ||
      e.includes('Internal Server Error')
    )
    if (restartErrors.length > 0) {
      console.error('Console errors about restart:', restartErrors)
    }
    expect(restartErrors).toHaveLength(0)

    console.log('✓ No 500 errors during Start Over')
  })

  test('modal closes after starting transcription restart', async ({ page }) => {
    const fileCards = page.locator('[data-component="file-card"]')
    const fileCount = await fileCards.count()

    if (fileCount < 1) {
      test.skip()
      return
    }

    // Find completed file
    let foundFile = false
    for (let i = 0; i < fileCount; i++) {
      const card = fileCards.nth(i)
      const status = await card.getAttribute('data-status')

      if (status === 'completed') {
        await card.click()
        await page.waitForTimeout(1000)

        const startOverButton = page.getByRole('button', { name: /start over/i })

        if (await startOverButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          foundFile = true
          await startOverButton.click()

          // Modal should be visible
          const modal = page.locator('[role="dialog"]')
          await expect(modal).toBeVisible()

          // Click confirm
          const confirmButton = modal.getByRole('button', { name: /(save|start|confirm)/i }).first()
          await confirmButton.click()

          // Modal should close within 2 seconds
          await expect(modal).not.toBeVisible({ timeout: 2000 })
          console.log('✓ Modal closed after restart initiated')

          break
        }
      }
    }

    if (!foundFile) {
      test.skip()
    }
  })

  test('status updates after force-restart', async ({ page }) => {
    const fileCards = page.locator('[data-component="file-card"]')
    const fileCount = await fileCards.count()

    if (fileCount < 1) {
      test.skip()
      return
    }

    // Find completed file
    let fileId: string | null = null
    for (let i = 0; i < fileCount; i++) {
      const card = fileCards.nth(i)
      const status = await card.getAttribute('data-status')

      if (status === 'completed') {
        fileId = await card.getAttribute('data-file-id')
        await card.click()
        await page.waitForTimeout(1000)

        const startOverButton = page.getByRole('button', { name: /start over/i })

        if (await startOverButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await startOverButton.click()

          const modal = page.locator('[role="dialog"]')
          await expect(modal).toBeVisible()

          const confirmButton = modal.getByRole('button', { name: /(save|start|confirm)/i }).first()
          await confirmButton.click()

          // Wait for modal to close
          await expect(modal).not.toBeVisible({ timeout: 2000 })

          // Wait for status to update (give it time to process)
          await page.waitForTimeout(3000)

          // Check if status changed (might be processing, pending, or still completed if queued)
          const statusPanel = page.locator('[data-component="transcription-progress"]').first()
          const newStatus = await statusPanel.getAttribute('data-status')

          console.log(`Status after restart: ${newStatus}`)

          // Status should be either:
          // - "processing" (if started immediately)
          // - "pending" (if queued)
          // - "whisper-loading" (if model loading)
          // Should NOT be in an error state
          expect(newStatus).not.toBe('failed')
          expect(newStatus).not.toBe('error')

          break
        }
      }
    }

    if (!fileId) {
      test.skip()
    }
  })
})
