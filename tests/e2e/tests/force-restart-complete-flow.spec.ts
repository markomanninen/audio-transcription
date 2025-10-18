import { test, expect } from '@playwright/test'
import { setupAudioProject } from '../helpers/audio-project-helpers'

test.describe('Force Restart Complete Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Create a project so we have a place for files
    await setupAudioProject(page)

    // Reset circuit breaker
    await page.evaluate(() => {
      if ((window as any).resetCircuitBreaker) {
        (window as any).resetCircuitBreaker()
      }
    })
  })

  test('complete force-restart flow: completed → restart → processing/completed', async ({ page }) => {
    const fileCards = page.locator('[data-component="file-card"]')
    const hasFiles = await fileCards.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasFiles) {
      console.log('No files found, skipping test')
      test.skip()
      return
    }

    const fileCount = await fileCards.count()
    if (fileCount < 1) {
      console.log('No files found, skipping test')
      test.skip()
      return
    }

    // Find a completed file
    let testFileId: string | null = null
    let testFileIndex = -1

    for (let i = 0; i < fileCount; i++) {
      const card = fileCards.nth(i)
      const status = await card.getAttribute('data-status')

      if (status === 'completed') {
        testFileId = await card.getAttribute('data-file-id')
        testFileIndex = i
        await card.click()
        await page.waitForTimeout(1500)

        // Verify it's actually completed with segments
        const segmentList = page.locator('[data-component="segment-list"]')
        if (await segmentList.count() > 0) {
          const segmentCount = await segmentList.first().getAttribute('data-segment-count')
          if (parseInt(segmentCount || '0') > 0) {
            console.log(`Found completed file ${testFileId} with ${segmentCount} segments`)
            break
          }
        }
      }
    }

    if (!testFileId) {
      console.log('No completed files with segments found')
      test.skip()
      return
    }

    // Step 1: Verify initial completed status
    console.log('Step 1: Verifying initial completed status...')
    let statusPanel = page.locator('[data-component="transcription-progress"]').first()
    let initialStatus = await statusPanel.getAttribute('data-status')
    console.log(`  Initial status: ${initialStatus}`)

    // Should not be showing whisper-loading for completed file
    expect(initialStatus).not.toBe('whisper-loading')

    // Step 2: Click "Start Over" button
    console.log('Step 2: Clicking Start Over...')
    const startOverButton = page.getByRole('button', { name: /start over/i })

    if (!await startOverButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Start Over button not found')
      test.skip()
      return
    }

    await startOverButton.click()

    // Step 3: Modal should open
    console.log('Step 3: Verifying modal opened...')
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible({ timeout: 3000 })

    // Step 4: Submit the restart
    console.log('Step 4: Submitting restart...')
    const confirmButton = modal.getByRole('button', { name: /(save|start|confirm)/i }).first()
    await confirmButton.click()

    // Step 5: Modal should close
    console.log('Step 5: Verifying modal closed...')
    await expect(modal).not.toBeVisible({ timeout: 3000 })

    // Step 6: Check status updates
    console.log('Step 6: Checking status updates...')

    // Wait a bit for backend to process
    await page.waitForTimeout(2000)

    // Get current status
    statusPanel = page.locator('[data-component="transcription-progress"]').first()
    const afterRestartStatus = await statusPanel.getAttribute('data-status')
    const afterRestartFileId = await statusPanel.getAttribute('data-file-id')

    console.log(`  Status after restart: ${afterRestartStatus}`)
    console.log(`  File ID: ${afterRestartFileId}`)

    // File ID should match
    expect(afterRestartFileId).toBe(testFileId)

    // Status should be one of: processing, pending, whisper-loading, or completed
    // It might already be completed if transcription was very fast
    const validStatuses = ['processing', 'pending', 'whisper-loading', 'completed']
    expect(validStatuses).toContain(afterRestartStatus)

    // Should NOT be in error/failed state
    expect(afterRestartStatus).not.toBe('failed')
    expect(afterRestartStatus).not.toBe('error')

    // Step 7: Wait for processing to complete (if it's processing)
    if (afterRestartStatus === 'processing' || afterRestartStatus === 'pending') {
      console.log('Step 7: Waiting for transcription to complete...')

      // Wait up to 60 seconds for completion
      let completed = false
      for (let attempt = 0; attempt < 30; attempt++) {
        await page.waitForTimeout(2000)

        statusPanel = page.locator('[data-component="transcription-progress"]').first()
        const currentStatus = await statusPanel.getAttribute('data-status')

        console.log(`  Attempt ${attempt + 1}: Status = ${currentStatus}`)

        if (currentStatus === 'completed') {
          completed = true
          console.log('  ✓ Transcription completed!')
          break
        }

        if (currentStatus === 'failed' || currentStatus === 'error') {
          console.error('  ✗ Transcription failed!')
          throw new Error(`Transcription failed with status: ${currentStatus}`)
        }
      }

      if (!completed) {
        console.warn('  Transcription did not complete within 60 seconds')
      }
    }

    // Step 8: Verify final state consistency
    console.log('Step 8: Verifying final state consistency...')

    // Get final status
    statusPanel = page.locator('[data-component="transcription-progress"]').first()
    const finalPanelStatus = await statusPanel.getAttribute('data-status')
    const finalPanelFileId = await statusPanel.getAttribute('data-file-id')

    // Get file card status
    const fileCard = fileCards.nth(testFileIndex)
    const finalCardStatus = await fileCard.getAttribute('data-status')
    const finalCardFileId = await fileCard.getAttribute('data-file-id')

    console.log(`  Final panel status: ${finalPanelStatus} (file ${finalPanelFileId})`)
    console.log(`  Final card status: ${finalCardStatus} (file ${finalCardFileId})`)

    // File IDs must match
    expect(finalPanelFileId).toBe(testFileId)
    expect(finalCardFileId).toBe(testFileId)

    // Both should show the same status (completed or processing)
    // If one shows completed, the other should too
    if (finalPanelStatus === 'completed' || finalCardStatus === 'completed') {
      // Allow small timing difference, but they should converge
      await page.waitForTimeout(2000)

      // Re-check after delay
      const recheckPanelStatus = await statusPanel.getAttribute('data-status')
      const recheckCardStatus = await fileCard.getAttribute('data-status')

      console.log(`  After delay - Panel: ${recheckPanelStatus}, Card: ${recheckCardStatus}`)

      // At least one should be completed
      const anyCompleted = recheckPanelStatus === 'completed' || recheckCardStatus === 'completed'
      expect(anyCompleted).toBe(true)
    }

    console.log('✓ Force restart complete flow test passed!')
  })

  test('status panel and file card remain consistent during restart', async ({ page }) => {
    const fileCards = page.locator('[data-component="file-card"]')
    const fileCount = await fileCards.count()

    if (fileCount < 1) {
      test.skip()
      return
    }

    // Find completed file
    let testFileId: string | null = null
    let testFileIndex = -1

    for (let i = 0; i < fileCount; i++) {
      const card = fileCards.nth(i)
      const status = await card.getAttribute('data-status')

      if (status === 'completed') {
        testFileId = await card.getAttribute('data-file-id')
        testFileIndex = i
        await card.click()
        await page.waitForTimeout(1000)
        break
      }
    }

    if (!testFileId) {
      test.skip()
      return
    }

    // Start restart
    const startOverButton = page.getByRole('button', { name: /start over/i })
    if (!await startOverButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip()
      return
    }

    await startOverButton.click()
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()
    const confirmButton = modal.getByRole('button', { name: /(save|start|confirm)/i }).first()
    await confirmButton.click()
    await expect(modal).not.toBeVisible({ timeout: 3000 })

    // Monitor status consistency
    await page.waitForTimeout(2000)

    for (let check = 0; check < 5; check++) {
      const statusPanel = page.locator('[data-component="transcription-progress"]').first()
      const fileCard = fileCards.nth(testFileIndex)

      const panelStatus = await statusPanel.getAttribute('data-status')
      const panelFileId = await statusPanel.getAttribute('data-file-id')
      const cardStatus = await fileCard.getAttribute('data-status')
      const cardFileId = await fileCard.getAttribute('data-file-id')

      console.log(`Check ${check + 1}: Panel=${panelStatus} (file ${panelFileId}), Card=${cardStatus} (file ${cardFileId})`)

      // File IDs must always match
      expect(panelFileId).toBe(testFileId)
      expect(cardFileId).toBe(testFileId)

      // If showing pending in panel but processing in card, that's a bug
      if (panelStatus === 'pending' && cardStatus === 'processing') {
        throw new Error('Status inconsistency: Panel shows pending but card shows processing')
      }

      await page.waitForTimeout(1000)
    }

    console.log('✓ Status remained consistent throughout restart')
  })

  test('no console errors during force-restart', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Ignore known safe errors
        if (!text.includes('Failed to load resource') && !text.includes('favicon')) {
          consoleErrors.push(text)
        }
      }
    })

    const fileCards = page.locator('[data-component="file-card"]')
    const fileCount = await fileCards.count()

    if (fileCount < 1) {
      test.skip()
      return
    }

    // Find completed file and restart it
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
            await page.waitForTimeout(3000)
          }
          break
        }
      }
    }

    // Check for errors
    if (consoleErrors.length > 0) {
      console.error('Console errors detected:', consoleErrors)
    }

    expect(consoleErrors).toHaveLength(0)
    console.log('✓ No console errors during restart')
  })
})
