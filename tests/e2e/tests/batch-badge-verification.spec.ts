import { test, expect, Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const API_BASE_URL = process.env.LOCAL_API_URL || 'http://127.0.0.1:8000'
const AUDIO_PATH = path.resolve(__dirname, '../assets/Kaaritorpantie - Rainer 5min.mp3')
const SCREENSHOTS_DIR = path.resolve(__dirname, '../screenshots/batch-badge-verification')

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

async function captureScreenshot(page: Page, name: string, description?: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${timestamp}-${name}.png`
  const filepath = path.join(SCREENSHOTS_DIR, filename)

  await page.screenshot({ path: filepath, fullPage: true })

  if (description) {
    console.log(`📸 Screenshot: ${name} - ${description}`)
  } else {
    console.log(`📸 Screenshot: ${name}`)
  }

  return filepath
}

interface FileCardState {
  filename: string
  status: string
  batchBadge: string | null
  hasStartButton: boolean
  hasProcessingIndicator: boolean
}

async function getFileCardState(page: Page, index: number): Promise<FileCardState> {
  const fileCard = page.locator('[data-component="file-card"]').nth(index)

  const filename = await fileCard.locator('[data-file-name]').textContent() || ''
  const status = await fileCard.getAttribute('data-status') || ''

  // Check for batch badge
  const batchBadgeLocator = fileCard.locator('span:has-text("Processing"), span:has-text("Batch")')
  const batchBadge = await batchBadgeLocator.count() > 0
    ? await batchBadgeLocator.textContent()
    : null

  // Check for start button
  const hasStartButton = await fileCard.locator('button:has-text("Start"), button:has-text("▶")').count() > 0

  // Check for processing indicator in status badge
  const hasProcessingIndicator = status === 'processing'

  return {
    filename,
    status,
    batchBadge,
    hasStartButton,
    hasProcessingIndicator
  }
}

async function getAllFileCardStates(page: Page): Promise<FileCardState[]> {
  const count = await page.locator('[data-component="file-card"]').count()
  const states: FileCardState[] = []

  for (let i = 0; i < count; i++) {
    states.push(await getFileCardState(page, i))
  }

  return states
}

async function printFileStates(states: FileCardState[], label: string) {
  console.log(`\n${label}:`)
  console.log('─'.repeat(80))
  states.forEach((state, index) => {
    const badgeEmoji = state.batchBadge === 'Processing' ? '▶️' : state.batchBadge === 'Batch' ? '⏸️' : '  '
    const statusEmoji = state.status === 'processing' ? '🔄' : state.status === 'completed' ? '✅' : state.status === 'pending' ? '⏳' : '❓'
    console.log(`${index + 1}. ${statusEmoji} ${state.filename}`)
    console.log(`   Status: ${state.status}`)
    console.log(`   Badge: ${badgeEmoji} ${state.batchBadge || 'None'}`)
    console.log(`   Has Start Button: ${state.hasStartButton ? 'Yes' : 'No'}`)
  })
  console.log('─'.repeat(80))
}

test.describe('Batch Badge Verification', () => {
  test('should show correct badges throughout batch transcription workflow', async ({ page }) => {
    test.setTimeout(180_000) // 3 minutes

    console.log('\n=== BATCH BADGE VERIFICATION TEST ===')
    console.log(`Audio file: ${AUDIO_PATH}`)
    console.log(`Screenshots: ${SCREENSHOTS_DIR}\n`)

    // Verify test file exists
    if (!fs.existsSync(AUDIO_PATH)) {
      throw new Error(`Test audio file not found: ${AUDIO_PATH}`)
    }

    // SETUP: Navigate and prepare
    console.log('[SETUP] Navigating to application...')
    await page.goto('/audio')

    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
      window.localStorage.setItem('hasSeenAudioTutorial', 'true')
      // Use tiny model for fast testing
      const stubSettings = JSON.stringify({
        model_size: 'tiny',
        language: null,
        include_diarization: false
      })
      window.localStorage.setItem('lastUsedTranscriptionSettings', stubSettings)
    })

    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 30_000 })
    await captureScreenshot(page, '01-app-ready')

    // Skip tutorial
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // STEP 1: Create project
    console.log('\n[STEP 1] Creating project...')
    const createButton = page.getByRole('button', { name: /new project|create.*project/i })
    await expect(createButton).toBeVisible({ timeout: 10_000 })
    await createButton.click()

    const projectName = `Badge Test ${Date.now()}`
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeVisible({ timeout: 5_000 })
    await page.getByLabel(/project name/i).fill(projectName)
    await page.getByRole('button', { name: /^create$/i }).click()
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeHidden({ timeout: 15_000 })

    const projectSelect = page.getByRole('banner').getByRole('combobox')
    await expect(projectSelect).toHaveValue(/^\d+$/, { timeout: 10_000 })

    console.log('✅ Project created')
    await captureScreenshot(page, '02-project-created')

    // STEP 2: Upload file
    console.log('\n[STEP 2] Uploading audio file...')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(AUDIO_PATH)

    // Wait for upload to complete
    await expect(page.locator('[data-component="file-card"]')).toBeVisible({ timeout: 30_000 })
    console.log('✅ File uploaded')
    await captureScreenshot(page, '03-file-uploaded')

    // TYPE CHECK 1: Initial state - single file, no badges
    let states = await getAllFileCardStates(page)
    await printFileStates(states, 'TYPE CHECK 1: Initial State (Single File)')

    expect(states).toHaveLength(1)
    expect(states[0].status).toBe('pending')
    expect(states[0].batchBadge).toBeNull() // No batch badge for single file
    await captureScreenshot(page, '04-type-check-1-initial')

    // STEP 3: Split into 3 chunks
    console.log('\n[STEP 3] Splitting file into 3 chunks...')
    const fileCard = page.locator('[data-component="file-card"]').first()

    // Find and click the split button (scissors icon)
    const splitButton = fileCard.locator('button[title*="Split"], button:has-text("✂")')
    await expect(splitButton).toBeVisible({ timeout: 5_000 })
    await splitButton.click()

    // Fill in split dialog
    await expect(page.getByRole('heading', { name: /split audio/i })).toBeVisible({ timeout: 5_000 })

    // Set number of chunks to 3
    const chunksInput = page.getByLabel(/number of chunks/i)
    await chunksInput.clear()
    await chunksInput.fill('3')

    // Click split button
    const splitConfirmButton = page.getByRole('button', { name: /^split$/i })
    await splitConfirmButton.click()

    // Wait for split to complete
    await expect(page.getByRole('heading', { name: /split audio/i })).toBeHidden({ timeout: 30_000 })

    // Wait for all 3 files to appear
    await expect(page.locator('[data-component="file-card"]')).toHaveCount(3, { timeout: 30_000 })

    console.log('✅ File split into 3 chunks')
    await captureScreenshot(page, '05-file-split-complete')

    // TYPE CHECK 2: After split - 3 files, all pending, all have "Batch" badge
    states = await getAllFileCardStates(page)
    await printFileStates(states, 'TYPE CHECK 2: After Split (3 Files)')

    expect(states).toHaveLength(3)
    states.forEach((state, index) => {
      expect(state.status, `File ${index + 1} should be pending`).toBe('pending')
      expect(state.batchBadge, `File ${index + 1} should have "Batch" badge`).toBe('Batch')
      expect(state.hasStartButton, `File ${index + 1} should have start button`).toBe(true)
    })
    await captureScreenshot(page, '06-type-check-2-after-split')

    // STEP 4: Check batch overlay appears
    console.log('\n[STEP 4] Checking for batch overlay...')

    // The batch overlay should NOT appear yet (files are pending, not processing)
    const batchOverlay = page.locator('[data-component="batch-progress"]')
    const overlayVisible = await batchOverlay.isVisible({ timeout: 2000 }).catch(() => false)

    if (overlayVisible) {
      console.log('⚠️  Batch overlay appeared before transcription started (unexpected)')
    } else {
      console.log('✅ Batch overlay correctly hidden (files are pending)')
    }

    // STEP 5: Start all transcriptions
    console.log('\n[STEP 5] Starting batch transcription...')

    // Click start button on each file
    for (let i = 0; i < 3; i++) {
      const card = page.locator('[data-component="file-card"]').nth(i)
      const startBtn = card.locator('button:has-text("Start"), button:has-text("▶")')

      if (await startBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await startBtn.click()
        console.log(`Started transcription for file ${i + 1}/3`)
        await page.waitForTimeout(500) // Small delay between starts
      }
    }

    console.log('✅ All transcriptions started')
    await captureScreenshot(page, '07-transcriptions-started')

    // TYPE CHECK 3: After starting - check badges update to "Processing"
    await page.waitForTimeout(2000) // Wait for status to update
    states = await getAllFileCardStates(page)
    await printFileStates(states, 'TYPE CHECK 3: After Starting Transcriptions')

    // At least one file should be processing
    const processingCount = states.filter(s => s.status === 'processing').length
    console.log(`Files processing: ${processingCount}/3`)

    // Files with status "processing" should show "Processing" badge
    // Files with status "pending" (queued) should show "Batch" badge
    states.forEach((state, index) => {
      if (state.status === 'processing') {
        expect(state.batchBadge, `File ${index + 1} (processing) should have "Processing" badge`).toBe('Processing')
      } else if (state.status === 'pending') {
        expect(state.batchBadge, `File ${index + 1} (pending) should have "Batch" badge`).toBe('Batch')
      }
    })
    await captureScreenshot(page, '08-type-check-3-processing')

    // STEP 6: Check batch overlay appears during processing
    console.log('\n[STEP 6] Checking batch overlay during processing...')

    const overlayNowVisible = await batchOverlay.isVisible({ timeout: 5000 }).catch(() => false)

    if (overlayNowVisible) {
      console.log('✅ Batch overlay appeared during processing')

      // Verify overlay content
      const overlayText = await batchOverlay.textContent()
      console.log(`Batch overlay text: ${overlayText}`)

      await captureScreenshot(page, '09-batch-overlay-visible')
    } else {
      console.log('⚠️  Batch overlay not visible (may have already completed)')
    }

    // STEP 7: Wait for transcriptions to complete
    console.log('\n[STEP 7] Waiting for transcriptions to complete...')

    // Poll for completion (max 2 minutes)
    let completedCount = 0
    const maxWait = 120_000 // 2 minutes
    const startTime = Date.now()

    while (Date.now() - startTime < maxWait) {
      states = await getAllFileCardStates(page)
      completedCount = states.filter(s => s.status === 'completed').length

      if (completedCount === 3) {
        console.log('✅ All 3 files completed')
        break
      }

      console.log(`Progress: ${completedCount}/3 files completed`)
      await printFileStates(states, `In Progress (${completedCount}/3 completed)`)
      await page.waitForTimeout(5000) // Check every 5 seconds
    }

    expect(completedCount, 'All 3 files should complete').toBe(3)
    await captureScreenshot(page, '10-all-completed')

    // TYPE CHECK 4: After completion - all completed, no batch badges
    states = await getAllFileCardStates(page)
    await printFileStates(states, 'TYPE CHECK 4: After Completion')

    states.forEach((state, index) => {
      expect(state.status, `File ${index + 1} should be completed`).toBe('completed')
      // Completed files should not show batch badges (they're no longer in the batch)
      // OR they might still show but shouldn't say "Processing"
      if (state.batchBadge) {
        expect(state.batchBadge, `File ${index + 1} batch badge should not be "Processing"`).not.toBe('Processing')
      }
    })
    await captureScreenshot(page, '11-type-check-4-completed')

    // STEP 8: Verify batch overlay disappears after completion
    console.log('\n[STEP 8] Verifying batch overlay disappears...')

    // Wait up to 10 seconds for overlay to disappear
    await expect(batchOverlay).toBeHidden({ timeout: 10_000 })
    console.log('✅ Batch overlay correctly hidden after completion')
    await captureScreenshot(page, '12-overlay-hidden')

    // TYPE CHECK 5: Final state verification
    console.log('\n[TYPE CHECK 5] Final State Verification')
    states = await getAllFileCardStates(page)
    await printFileStates(states, 'FINAL STATE')

    // All assertions
    expect(states).toHaveLength(3)
    states.forEach((state, index) => {
      expect(state.status, `File ${index + 1} final status`).toBe('completed')
      expect(state.hasStartButton, `File ${index + 1} should not have start button`).toBe(false)
    })

    console.log('\n✅ ALL TYPE CHECKS PASSED')
    console.log('─'.repeat(80))
  })
})
