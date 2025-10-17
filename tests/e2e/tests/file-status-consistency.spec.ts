import { test, expect } from '@playwright/test'

test.describe('File Status Consistency', () => {
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

    // Wait for backend to be ready and file list to load
    // Give extra time for circuit breaker recovery and project loading
    await page.waitForSelector('[data-component="file-list"]', { timeout: 30000 })
  })

  test('file list and status panel show consistent status when switching files', async ({ page }) => {
    // Wait for seeded files
    await page.waitForSelector('[data-component="file-list"]', { timeout: 30000 })
    const fileCards = page.locator('[data-component="file-card"]')
    await expect(fileCards.first()).toBeVisible({ timeout: 10000 })

    const fileCount = await fileCards.count()
    if (fileCount < 2) {
      test.skip()
      return
    }

    // Test switching between first two files
    for (let i = 0; i < 2; i++) {
      const fileCard = fileCards.nth(i)

      // Click file card
      await fileCard.click()
      await page.waitForTimeout(1000) // Wait for data to load

      // Extract status from file card
      const fileCardStatus = await fileCard.getAttribute('data-status')
      const fileCardId = await fileCard.getAttribute('data-file-id')

      console.log(`File ${fileCardId}: Card status = ${fileCardStatus}`)

      // Get status panel
      const statusPanel = page.locator('[data-component="transcription-progress"]')

      if (await statusPanel.count() > 0) {
        const panelStatus = await statusPanel.first().getAttribute('data-status')
        const panelFileId = await statusPanel.first().getAttribute('data-file-id')

        console.log(`File ${fileCardId}: Panel status = ${panelStatus}, Panel fileId = ${panelFileId}`)

        // File IDs must match
        expect(panelFileId).toBe(fileCardId)

        // If file is completed, both should show completed
        if (fileCardStatus === 'completed') {
          // Panel should NOT show whisper-loading or model_loading
          expect(panelStatus).not.toBe('whisper-loading')
          expect(panelStatus).not.toBe('model_loading')

          // Should show segments
          const segmentList = page.locator('[data-component="segment-list"]')
          if (await segmentList.count() > 0) {
            const segmentCount = await segmentList.first().getAttribute('data-segment-count')
            expect(parseInt(segmentCount || '0')).toBeGreaterThan(0)
            console.log(`  - Segments visible: ${segmentCount}`)
          }
        }

        // If file is pending, check for model loading vs truly pending
        if (fileCardStatus === 'pending') {
          // If panel shows whisper-loading, that's acceptable
          // If panel shows pending, check that segments = 0
          if (panelStatus !== 'whisper-loading') {
            const segmentList = page.locator('[data-component="segment-list"]')
            if (await segmentList.count() > 0) {
              const segmentCount = await segmentList.first().getAttribute('data-segment-count')
              console.log(`  - Pending file segments: ${segmentCount}`)
            }
          }
        }
      }
    }
  })

  test('refreshing page maintains correct status display', async ({ page }) => {
    // Wait for seeded files
    await page.waitForSelector('[data-component="file-list"]', { timeout: 30000 })
    const fileCards = page.locator('[data-component="file-card"]')
    await expect(fileCards.first()).toBeVisible({ timeout: 10000 })

    const fileCount = await fileCards.count()
    if (fileCount < 1) {
      test.skip()
      return
    }

    // Click first file
    const firstFile = fileCards.first()
    await firstFile.click()
    await page.waitForTimeout(1000)

    // Get initial status
    const initialCardStatus = await firstFile.getAttribute('data-status')
    const initialFileId = await firstFile.getAttribute('data-file-id')
    const initialPanelStatus = await page.locator('[data-component="transcription-progress"]').first().getAttribute('data-status')

    console.log(`Before refresh: File ${initialFileId}, Card=${initialCardStatus}, Panel=${initialPanelStatus}`)

    // Refresh page
    await page.reload()
    await page.waitForSelector('[data-component="file-list"]', { timeout: 10000 })
    await page.waitForTimeout(2000) // Wait for auto-selection and data load

    // Check if same file is selected (should be from localStorage)
    const statusPanel = page.locator('[data-component="transcription-progress"]')
    if (await statusPanel.count() > 0) {
      const panelFileId = await statusPanel.first().getAttribute('data-file-id')
      const panelStatus = await statusPanel.first().getAttribute('data-status')

      console.log(`After refresh: File ${panelFileId}, Panel=${panelStatus}`)

      // If completed before refresh, should still be completed
      if (initialCardStatus === 'completed') {
        // Should not show model loading for completed files
        expect(panelStatus).not.toBe('whisper-loading')
        expect(panelStatus).not.toBe('model_loading')

        // Should have segments
        const segmentList = page.locator('[data-component="segment-list"]')
        if (await segmentList.count() > 0) {
          const segmentCount = await segmentList.first().getAttribute('data-segment-count')
          expect(parseInt(segmentCount || '0')).toBeGreaterThan(0)
          console.log(`  - Segments after refresh: ${segmentCount}`)
        }
      }
    }
  })

  test('switching between completed files shows correct segment counts', async ({ page }) => {
    // Wait for seeded files
    await page.waitForSelector('[data-component="file-list"]', { timeout: 30000 })
    const fileCards = page.locator('[data-component="file-card"]')
    await expect(fileCards.first()).toBeVisible({ timeout: 10000 })

    const fileCount = await fileCards.count()
    if (fileCount < 2) {
      test.skip()
      return
    }

    // Find completed files
    const completedFiles: { index: number; id: string; segments: string }[] = []

    for (let i = 0; i < fileCount; i++) {
      const card = fileCards.nth(i)
      const status = await card.getAttribute('data-status')
      const fileId = await card.getAttribute('data-file-id')

      if (status === 'completed' && fileId) {
        // Click to get segment count
        await card.click()
        await page.waitForTimeout(1000)

        const segmentList = page.locator('[data-component="segment-list"]')
        if (await segmentList.count() > 0) {
          const segmentCount = await segmentList.first().getAttribute('data-segment-count') || '0'
          completedFiles.push({ index: i, id: fileId, segments: segmentCount })
          console.log(`Found completed file ${fileId} with ${segmentCount} segments`)
        }
      }
    }

    if (completedFiles.length < 2) {
      console.log('Not enough completed files for testing')
      test.skip()
      return
    }

    // Switch between first two completed files multiple times
    for (let round = 0; round < 3; round++) {
      for (const file of completedFiles.slice(0, 2)) {
        await fileCards.nth(file.index).click()
        await page.waitForTimeout(500)

        // Verify correct segments shown
        const segmentList = page.locator('[data-component="segment-list"]')
        const actualSegmentCount = await segmentList.first().getAttribute('data-segment-count') || '0'
        const panelFileId = await page.locator('[data-component="transcription-progress"]').first().getAttribute('data-file-id')

        console.log(`Round ${round + 1}: File ${file.id} expected ${file.segments} segments, got ${actualSegmentCount}`)

        expect(panelFileId).toBe(file.id)
        expect(actualSegmentCount).toBe(file.segments)
      }
    }
  })

  test('no console errors during file switching', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => {
      errors.push(error.message)
      console.error('Page error:', error.message)
    })

    // Wait for seeded files
    await page.waitForSelector('[data-component="file-list"]', { timeout: 30000 })
    const fileCards = page.locator('[data-component="file-card"]')
    await expect(fileCards.first()).toBeVisible({ timeout: 10000 })

    const fileCount = await fileCards.count()
    if (fileCount < 2) {
      test.skip()
      return
    }

    // Switch between files rapidly
    for (let i = 0; i < Math.min(fileCount, 5); i++) {
      await fileCards.nth(i % fileCount).click()
      await page.waitForTimeout(300)
    }

    // Should have no errors
    expect(errors).toHaveLength(0)
  })
})
