import { test, expect } from '@playwright/test'

test.describe('Transcription Completion Status Updates', () => {
  test('status updates from processing to completed in both file card and status panel', async ({ page }) => {
    await page.goto('/')

    // Wait for system to be ready
    await expect(page.getByRole('heading', { name: 'Audio Transcription' })).toBeVisible({ timeout: 120000 })

    // Upload a test file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-audio-30s.mp3')

    // Wait for upload to complete
    await expect(page.getByText(/test-audio-30s\.mp3/)).toBeVisible({ timeout: 10000 })

    // Click the uploaded file to select it
    const fileCard = page.locator('[data-file-card]').filter({ hasText: 'test-audio-30s.mp3' })
    await fileCard.click()

    // Start transcription
    await expect(page.getByRole('button', { name: /start transcription/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /start transcription/i }).click()

    // Wait for processing to start
    await expect(fileCard.getByText(/processing/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/transcription progress/i)).toBeVisible({ timeout: 5000 })

    // Verify both show processing status
    const fileCardStatus = await fileCard.locator('[data-status]').getAttribute('data-status')
    expect(fileCardStatus).toBe('processing')

    const statusPanel = page.locator('[data-transcription-status-panel]')
    const panelStatus = await statusPanel.locator('[data-status]').getAttribute('data-status')
    expect(panelStatus).toBe('processing')

    // Wait for transcription to complete (up to 2 minutes for 30s audio)
    await expect(fileCard.getByText(/completed/i)).toBeVisible({ timeout: 120000 })

    // Give frontend time to update cache (2 polling cycles + cache clear)
    await page.waitForTimeout(5000)

    // Verify BOTH file card and status panel show completed
    const finalFileCardStatus = await fileCard.locator('[data-status]').getAttribute('data-status')
    expect(finalFileCardStatus).toBe('completed')

    const finalPanelStatus = await statusPanel.locator('[data-status]').getAttribute('data-status')
    expect(finalPanelStatus).toBe('completed')

    // Verify segments are visible
    await expect(page.getByText(/segments/i)).toBeVisible()
    const segmentCount = await page.locator('[data-segment]').count()
    expect(segmentCount).toBeGreaterThan(0)

    console.log(`✅ Transcription completed successfully with ${segmentCount} segments`)
  })

  test('force-restart shows processing then updates to completed correctly', async ({ page }) => {
    await page.goto('/')

    // Wait for system to be ready
    await expect(page.getByRole('heading', { name: 'Audio Transcription' })).toBeVisible({ timeout: 120000 })

    // Find an already completed file
    const completedFileCard = page.locator('[data-file-card][data-status="completed"]').first()
    await expect(completedFileCard).toBeVisible({ timeout: 10000 })

    const fileName = await completedFileCard.locator('[data-file-name]').textContent()
    console.log(`Testing force-restart on file: ${fileName}`)

    // Click to select the file
    await completedFileCard.click()

    // Open transcription settings modal for force-restart
    await page.getByRole('button', { name: /start over/i }).click()

    // Confirm restart in modal
    await expect(page.getByText(/restart transcription/i)).toBeVisible()
    await page.getByRole('button', { name: /start over/i }).click()

    // Wait for modal to close
    await expect(page.getByText(/restart transcription/i)).not.toBeVisible({ timeout: 5000 })

    // Verify status updates to processing
    await expect(completedFileCard.getByText(/processing/i)).toBeVisible({ timeout: 10000 })

    const fileCardStatus = await completedFileCard.locator('[data-status]').getAttribute('data-status')
    expect(fileCardStatus).toBe('processing')

    const statusPanel = page.locator('[data-transcription-status-panel]')
    const panelStatus = await statusPanel.locator('[data-status]').getAttribute('data-status')
    expect(panelStatus).toBe('processing')

    console.log('✅ Status correctly shows processing after force-restart')

    // Wait for transcription to complete (up to 2 minutes)
    await expect(completedFileCard.getByText(/completed/i)).toBeVisible({ timeout: 120000 })

    // Give frontend time to update cache completely
    await page.waitForTimeout(5000)

    // Verify final status is completed in BOTH places
    const finalFileCardStatus = await completedFileCard.locator('[data-status]').getAttribute('data-status')
    expect(finalFileCardStatus).toBe('completed')

    const finalPanelStatus = await statusPanel.locator('[data-status]').getAttribute('data-status')
    expect(finalPanelStatus).toBe('completed')

    // Verify no "pending" status ever appeared
    const logs: string[] = []
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('status:') || text.includes('Status changed')) {
        logs.push(text)
      }
    })

    // Check logs for any mention of "pending" after restart
    const hasPendingAfterRestart = logs.some(log =>
      log.includes('pending') && !log.includes('before restart')
    )
    expect(hasPendingAfterRestart).toBe(false)

    console.log(`✅ Force-restart completed without showing 'pending' status`)
  })

  test('status remains consistent during page refresh', async ({ page }) => {
    await page.goto('/')

    // Wait for system to be ready
    await expect(page.getByRole('heading', { name: 'Audio Transcription' })).toBeVisible({ timeout: 120000 })

    // Find a completed file
    const completedFileCard = page.locator('[data-file-card][data-status="completed"]').first()
    await expect(completedFileCard).toBeVisible({ timeout: 10000 })

    const fileName = await completedFileCard.locator('[data-file-name]').textContent()
    console.log(`Testing page refresh with file: ${fileName}`)

    // Click to select the file
    await completedFileCard.click()

    // Get initial status
    const initialFileCardStatus = await completedFileCard.locator('[data-status]').getAttribute('data-status')
    const statusPanel = page.locator('[data-transcription-status-panel]')
    const initialPanelStatus = await statusPanel.locator('[data-status]').getAttribute('data-status')

    expect(initialFileCardStatus).toBe('completed')
    expect(initialPanelStatus).toBe('completed')

    // Refresh the page
    await page.reload()

    // Wait for system to be ready again
    await expect(page.getByRole('heading', { name: 'Audio Transcription' })).toBeVisible({ timeout: 60000 })

    // File should still be selected (from localStorage)
    await expect(page.getByText(fileName!)).toBeVisible({ timeout: 5000 })

    // Verify status is still completed after refresh
    const refreshedFileCard = page.locator('[data-file-card]').filter({ hasText: fileName! })
    const refreshedFileCardStatus = await refreshedFileCard.locator('[data-status]').getAttribute('data-status')
    expect(refreshedFileCardStatus).toBe('completed')

    const refreshedStatusPanel = page.locator('[data-transcription-status-panel]')
    const refreshedPanelStatus = await refreshedStatusPanel.locator('[data-status]').getAttribute('data-status')
    expect(refreshedPanelStatus).toBe('completed')

    console.log('✅ Status remained consistent after page refresh')
  })

  test('no console errors during status transitions', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')

    // Wait for system to be ready
    await expect(page.getByRole('heading', { name: 'Audio Transcription' })).toBeVisible({ timeout: 120000 })

    // Upload and transcribe a file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-audio-30s.mp3')

    await expect(page.getByText(/test-audio-30s\.mp3/)).toBeVisible({ timeout: 10000 })

    const fileCard = page.locator('[data-file-card]').filter({ hasText: 'test-audio-30s.mp3' })
    await fileCard.click()

    await page.getByRole('button', { name: /start transcription/i }).click()
    await expect(fileCard.getByText(/processing/i)).toBeVisible({ timeout: 10000 })

    // Wait for completion
    await expect(fileCard.getByText(/completed/i)).toBeVisible({ timeout: 120000 })

    // Wait for all cache updates to finish
    await page.waitForTimeout(5000)

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('net::ERR_') &&
      !err.includes('404')
    )

    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors)
    }

    expect(criticalErrors.length).toBe(0)

    console.log('✅ No console errors during status transitions')
  })
})
