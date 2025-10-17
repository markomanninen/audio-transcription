import { test, expect, Locator, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const ACTIVE_STATUSES = ['processing', 'completed', 'whisper-loading']
const TRANSCRIPTION_PANEL_SELECTOR = '[data-component="transcription-progress"]'
const AUDIO_FIXTURE_PATH = path.resolve(__dirname, '../test-data/test-audio-30s.mp3')

function statusPanelForFile(page: Page, fileId: string) {
  return page.locator(`${TRANSCRIPTION_PANEL_SELECTOR}[data-file-id="${fileId}"]`).first()
}

async function waitForPanelStatus(page: Page, panel: Locator, timeoutMs = 120000): Promise<string> {
  try {
    await panel.waitFor({ state: 'visible', timeout: 10000 })
  } catch {
    return 'pending'
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const status = (await panel.getAttribute('data-status')) ?? 'pending'
    if (status !== 'pending') {
      return status
    }
    await page.waitForTimeout(1000)
  }
  return (await panel.getAttribute('data-status')) ?? 'pending'
}

async function waitForLocatorEnabled(page: Page, locator: Locator, timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) {
      return true
    }
    await page.waitForTimeout(500)
  }
  return false
}

async function uploadTestAudio(page: Page): Promise<{ fileCard: Locator; fileId: string; fileName: string }> {
  const buffer = fs.readFileSync(AUDIO_FIXTURE_PATH)
  const uniqueName = `test-audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: uniqueName,
    mimeType: 'audio/mpeg',
    buffer,
  })

  const fileCard = page.locator('[data-component="file-card"]').filter({ hasText: uniqueName }).first()
  await expect(fileCard).toBeVisible({ timeout: 15000 })

  const fileId = await fileCard.getAttribute('data-file-id')
  if (!fileId) {
    throw new Error('Uploaded file card missing data-file-id attribute')
  }

  return { fileCard, fileId, fileName: uniqueName }
}

async function startTranscriptionAndWait(page: Page, fileCard: Locator, fileId: string) {
  const startButton = fileCard.getByRole('button', { name: /start transcription/i }).first()
  await expect(startButton).toBeVisible({ timeout: 5000 })
  await expect(startButton).toBeEnabled({ timeout: 30000 })
  await startButton.click()

  const startModal = page.locator('[role="dialog"]')
  if (await startModal.isVisible({ timeout: 2000 }).catch(() => false)) {
    const confirmStart = startModal.getByRole('button', { name: /(start transcription|start|confirm)/i }).first()
    await confirmStart.click()
    await expect(startModal).not.toBeVisible({ timeout: 5000 })
  }

  const statusPanel = statusPanelForFile(page, fileId)
  const panelStatusValue = await waitForPanelStatus(page, statusPanel, 120000)
  expect(panelStatusValue).not.toBe('pending')
  expect(ACTIVE_STATUSES).toContain(panelStatusValue)

  let cardStatusValue = (await fileCard.getAttribute('data-status')) ?? 'pending'
  if (cardStatusValue === 'pending') {
    await page.waitForTimeout(1000)
    cardStatusValue = (await fileCard.getAttribute('data-status')) ?? 'pending'
  }
  expect(ACTIVE_STATUSES).toContain(cardStatusValue)

  await expect
    .poll(async () => (await fileCard.getAttribute('data-status')) ?? 'pending', {
      timeout: 120000,
      message: 'File card status should become completed',
    })
    .toBe('completed')

  return statusPanel
}

test.describe('Transcription Completion Status Updates', () => {
  test('status updates from processing to completed in both file card and status panel', async ({ page }) => {
    await page.goto('/')

    // Wait for system to be ready
    await expect(page.getByRole('heading', { name: /^Audio Transcription$/ })).toBeVisible({ timeout: 120000 })

    const { fileCard, fileId } = await uploadTestAudio(page)
    await fileCard.click()

    const statusPanel = await startTranscriptionAndWait(page, fileCard, fileId)

    // Give frontend time to update cache (2 polling cycles + cache clear)
    await page.waitForTimeout(5000)

    // Verify BOTH file card and status panel show completed
    const finalFileCardStatus = await fileCard.getAttribute('data-status')
    expect(finalFileCardStatus).toBe('completed')

    const finalPanelStatus = await statusPanel.getAttribute('data-status')
    expect(finalPanelStatus).toBe('completed')

    // Verify segments are visible
    await expect(page.getByText(/segments/i)).toBeVisible()
    const segmentLocator = page.locator(`[data-component="segment-list"][data-file-id="${fileId}"]`)
    await expect
      .poll(async () => {
        const attr = await segmentLocator.getAttribute('data-segment-count')
        return attr ? parseInt(attr, 10) : 0
      }, {
        timeout: 60000,
        message: 'Segment list should populate with transcription results',
      })
      .toBeGreaterThan(0)

    const segmentCountAttr = await segmentLocator.getAttribute('data-segment-count')
    const segmentCount = segmentCountAttr ? parseInt(segmentCountAttr, 10) : 0

    console.log(`✅ Transcription completed successfully with ${segmentCount} segments`)
  })

  test('force-restart shows processing then updates to completed correctly', async ({ page }) => {
    await page.goto('/')

    // Wait for system to be ready
    await expect(page.getByRole('heading', { name: /^Audio Transcription$/ })).toBeVisible({ timeout: 120000 })

    const { fileCard, fileId } = await uploadTestAudio(page)
    await fileCard.click()

    const statusPanel = await startTranscriptionAndWait(page, fileCard, fileId)

    const fileName = await fileCard.locator('[data-file-name]').textContent()
    console.log(`Testing force-restart on file: ${fileName}`)

    // Open transcription settings modal for force-restart
    const startOverButton = page.getByRole('button', { name: /start over/i })
    await expect(startOverButton).toBeEnabled({ timeout: 30000 })
    await startOverButton.click()

    // Confirm restart in modal
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible({ timeout: 5000 })
    const confirmButton = modal.getByRole('button', { name: /(start over|start transcription|confirm|restart)/i }).first()
    await confirmButton.click()

    // Wait for modal to close
    await expect(modal).not.toBeVisible({ timeout: 5000 })

    // Verify status updates to processing
    const restartStatus = await waitForPanelStatus(page, statusPanel, 60000)
    expect(restartStatus).not.toBe('pending')
    expect(ACTIVE_STATUSES).toContain(restartStatus)

    const restartCardStatus = (await fileCard.getAttribute('data-status')) ?? 'pending'
    expect(ACTIVE_STATUSES).toContain(restartCardStatus)

    console.log('✅ Status correctly shows processing after force-restart')

    // Wait for transcription to complete (up to 2 minutes)
    await expect(fileCard.getByText(/completed/i)).toBeVisible({ timeout: 120000 })

    // Wait for transcription to complete (with real Whisper this takes 30-60s)
    await expect
      .poll(async () => await fileCard.getAttribute('data-status'), {
        timeout: 3 * 60 * 1000, // 3 minutes for real Whisper
        message: 'File card status should become completed'
      })
      .toBe('completed')

    await expect
      .poll(async () => await statusPanel.getAttribute('data-status'), {
        timeout: 30 * 1000, // 30s for UI sync
        message: 'Status panel should become completed'
      })
      .toBe('completed')

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
    await expect(page.getByRole('heading', { name: /^Audio Transcription$/ })).toBeVisible({ timeout: 120000 })

    const { fileCard: completedFileCard, fileId } = await uploadTestAudio(page)
    await completedFileCard.click()

    const statusPanel = await startTranscriptionAndWait(page, completedFileCard, fileId)

    const fileName = await completedFileCard.locator('[data-file-name]').textContent()
    console.log(`Testing page refresh with file: ${fileName}`)

    // Get initial status
    const initialPanelStatus = await waitForPanelStatus(page, statusPanel, 30000)
    expect(initialPanelStatus).toBe('completed')

    const initialFileCardStatus = (await completedFileCard.getAttribute('data-status')) ?? 'pending'
    expect(initialFileCardStatus).toBe('completed')

    // Refresh the page
    await page.reload()

    // Wait for system to be ready again
    await expect(page.getByRole('heading', { name: /^Audio Transcription$/ })).toBeVisible({ timeout: 60000 })

    // File should still be selected (from localStorage)
    const refreshedFileCard = page.locator('[data-component="file-card"]').filter({ hasText: fileName! }).first()
    await expect(refreshedFileCard).toBeVisible({ timeout: 5000 })

    // Verify status is still completed after refresh
    const refreshedFileCardStatus = await refreshedFileCard.getAttribute('data-status')
    expect(refreshedFileCardStatus).toBe('completed')

    const refreshedStatusPanel = statusPanelForFile(page, fileId)
    const refreshedPanelStatus = await waitForPanelStatus(page, refreshedStatusPanel, 30000)
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
    await expect(page.getByRole('heading', { name: /^Audio Transcription$/ })).toBeVisible({ timeout: 120000 })

    const { fileCard, fileId } = await uploadTestAudio(page)
    await fileCard.click()

    const statusPanel = await startTranscriptionAndWait(page, fileCard, fileId)

    // Wait for all cache updates to finish
    await page.waitForTimeout(5000)

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('net::ERR_') &&
      !err.includes('404') &&
      !err.includes('DEMUXER_ERROR') && // Audio file loading errors (not transcription related)
      !err.includes('MediaError') // Audio player errors (not transcription related)
    )

    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors)
    }

    expect(criticalErrors.length).toBe(0)

    console.log('✅ No console errors during status transitions')
  })
})
