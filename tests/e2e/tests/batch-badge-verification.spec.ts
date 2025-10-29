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

  // Check for batch badge - look for specific batch badge styling
  const batchBadgeLocator = fileCard.locator('span.text-\\[10px\\]').filter({ hasText: /^(Processing|Batch|Completed)$/i })
  const batchBadge = await batchBadgeLocator.count() > 0
    ? await batchBadgeLocator.textContent()
    : null

  // Check for start button
  const startButtonLocator = fileCard.locator('button:has-text("Start Transcription"), button:has-text("▶")')
  const hasStartButton = await startButtonLocator.count() > 0

  // Check for processing indicator
  const processingIndicator = fileCard.locator('[data-testid="processing-indicator"]')
  const hasProcessingIndicator = await processingIndicator.count() > 0

  return {
    filename,
    status,
    batchBadge,
    hasStartButton,
    hasProcessingIndicator
  }
}

async function getAllFileCardStates(page: Page): Promise<FileCardState[]> {
  const fileCards = page.locator('[data-component="file-card"]')
  const count = await fileCards.count()

  const states: FileCardState[] = []
  for (let i = 0; i < count; i++) {
    const state = await getFileCardState(page, i)
    states.push(state)
  }

  return states
}

async function printFileStates(states: FileCardState[], title: string) {
  console.log(`\n[${title}]`)
  states.forEach((state, index) => {
    console.log(`  File ${index + 1}: "${state.filename}"`)
    console.log(`    Status: ${state.status}`)
    console.log(`    Badge: ${state.batchBadge || 'none'}`)
    console.log(`    Start Button: ${state.hasStartButton}`)
    console.log(`    Processing: ${state.hasProcessingIndicator}`)
  })
}

test.describe('Batch Badge Verification Tests', () => {
  test('should correctly show batch processing badges throughout the workflow', async ({ page, browserName }) => {
    // Skip non-Chrome browsers for faster testing
    test.skip(browserName !== 'chromium', 'Running only on Chrome for faster testing')
    
    // Set a longer timeout for this test (5 minutes)
    test.setTimeout(300000)
    
    const testStartTime = Date.now()
    console.log('Starting Batch Badge Verification Test')

    // STEP -1: Clean up old projects and processes
    console.log('\n[STEP -1] Cleaning up old test data...')
    try {
      // Get all projects
      const projectsResponse = await fetch(`${API_BASE_URL}/api/upload/projects`)
      if (projectsResponse.ok) {
        const projects = await projectsResponse.json()
        
        // Delete ALL projects (not just test projects) to ensure clean slate
        for (const project of projects) {
          console.log(`Deleting project: ${project.name} (ID: ${project.id})`)
          try {
            const deleteResponse = await fetch(`${API_BASE_URL}/api/upload/project/${project.id}`, {
              method: 'DELETE'
            })
            if (deleteResponse.ok) {
              console.log(`  ✓ Deleted project ${project.id}`)
              // Wait for database operation to complete
              await new Promise(resolve => setTimeout(resolve, 500))
            } else {
              console.log(`  ✗ Failed to delete project ${project.id}: ${deleteResponse.status}`)
            }
          } catch (error) {
            console.log(`  ✗ Error deleting project ${project.id}:`, error instanceof Error ? error.message : String(error))
          }
        }
      }
      
      // Force stop any active transcriptions
      try {
        const stopResponse = await fetch(`${API_BASE_URL}/api/transcription/stop-all`, {
          method: 'POST'
        })
        if (stopResponse.ok) {
          console.log('[PASS] Stopped all active transcriptions')
        }
      } catch (error) {
        console.log('[INFO] No active transcriptions to stop or API endpoint not available')
      }
      
      // Additional cleanup: Clear any cached whisper models/processes
      try {
        const clearCacheResponse = await fetch(`${API_BASE_URL}/api/transcription/clear-cache`, {
          method: 'POST'
        })
        if (clearCacheResponse.ok) {
          console.log('[PASS] Cleared transcription cache')
        }
      } catch (error) {
        console.log('[INFO] Cache clear endpoint not available or already clean')
      }
      
      console.log('[PASS] Cleanup completed')
      
      // Wait longer for system to stabilize after cleanup and database operations
      console.log('[INFO] Waiting for system stabilization...')
      await new Promise(resolve => setTimeout(resolve, 8000))
    } catch (error) {
      console.warn('[WARN] Cleanup failed, continuing with test:', error)
    }

    // STEP 0: Ensure API is available
    console.log('\n[STEP 0] Checking API availability...')
    try {
      const response = await fetch(`${API_BASE_URL}/health`)
      if (!response.ok) {
        throw new Error(`API health check failed: ${response.status}`)
      }
      console.log('[PASS] API is available')
    } catch (error) {
      console.error('[FAIL] API is not available:', error)
      throw error
    }

    // Navigate to app and force cache refresh
    await page.goto('/audio')
    
    // Force refresh to clear any cached project data
    await page.reload({ waitUntil: 'networkidle' })
    console.log('[PASS] Refreshed page to clear frontend cache')

    // Clear all browser storage and cache for a completely clean state
    await page.evaluate(() => {
      // Clear localStorage
      localStorage.clear()
      // Clear sessionStorage  
      sessionStorage.clear()
      // Clear React Query cache by reloading if window.__REACT_QUERY_STATE__ exists
      if ((window as any).__REACT_QUERY_STATE__) {
        (window as any).__REACT_QUERY_STATE__ = {}
      }
    })
    console.log('[PASS] Cleared browser storage and cache')

    // Skip tutorial and set last used model to medium (better for testing states)
    await page.evaluate(() => {
      localStorage.setItem('hasSeenTutorial', 'true')
      localStorage.setItem('lastUsedTranscriptionSettings', JSON.stringify({
        model_size: 'medium',
        language: 'auto',
        task: 'transcribe',
        temperature: 0,
        use_vad: true,
        use_diarization: false,
        num_speakers: 2
      }))
    })

    // Reload once more to ensure all settings take effect
    await page.reload({ waitUntil: 'networkidle' })

    // Wait for app to be ready
    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {})

    // Verify that project list is clean (no old test projects)
    console.log('\n[VERIFICATION] Checking project list is clean...')
    
    // Wait for the page to load and look for project selector
    await page.waitForTimeout(2000)
    
    // Check if project selector shows the empty state (no projects)
    const projectSelector = page.locator('select:has(option:text("Select a project..."))')
    const hasProjectSelector = await projectSelector.count() > 0
    
    if (hasProjectSelector) {
      // There's a selector, check if there are actual projects
      const projectOptions = await projectSelector.locator('option:not(:text("Select a project..."))').count()
      if (projectOptions > 0) {
        console.log(`[WARNING] Found ${projectOptions} existing projects in selector - cleanup may have failed`)
        await captureScreenshot(page, 'existing-projects-found', `Found ${projectOptions} existing projects`)
      } else {
        console.log('[PASS] Project selector exists but no projects found - system is clean')
      }
    } else {
      // No selector means no projects at all - this is what we want
      console.log('[PASS] No project selector found - system is completely clean')
    }

    // Skip tutorial if it appears
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // Wait for "New Project" button to appear
    const createButton = page.getByRole('button', { name: 'New Project' })
    await expect(createButton).toBeVisible({ timeout: 10_000 })
    await captureScreenshot(page, '01-app-ready')

    // STEP 1: Create project and upload file
    console.log('\n[STEP 1] Creating project and uploading file...')

    await createButton.click()

    const projectName = `Batch Badge Test ${Date.now()}`
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeVisible({ timeout: 5_000 })
    await page.getByLabel(/project name/i).fill(projectName)
    await page.getByRole('button', { name: /^create$/i }).click()
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeHidden({ timeout: 15_000 })

    // Skip project selector validation - just wait for modal to close
    await page.waitForTimeout(2000) // Give project time to be selected

    await captureScreenshot(page, '02-project-created')

    // Upload the audio file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(AUDIO_PATH)
    await page.waitForSelector('[data-component="file-card"]', { timeout: 15000 })

    await captureScreenshot(page, '03-file-uploaded')

    // STEP 2: Initial state check - should be 1 file, status "pending", no badge
    console.log('\n[STEP 2] Checking initial file state...')

    let states = await getAllFileCardStates(page)
    await printFileStates(states, 'TYPE CHECK 1: Initial State')

    expect(states.length, 'Should have exactly 1 file initially').toBe(1)

    const initialState = states[0]
    expect(initialState.status, 'Initial file should be pending').toBe('pending')
    expect(initialState.batchBadge, 'Initial file should have no badge').toBeNull()
    expect(initialState.hasStartButton, 'Initial file should have start button').toBe(true)

    await captureScreenshot(page, '04-type-check-1-initial')

    // STEP 3: Split file into chunks using split & batch button
    console.log('\n[STEP 3] Splitting file into chunks...')

    const fileCard = page.locator('[data-component="file-card"]').first()
    
    // Look for the split button with scissors emoji and title
    const splitButton = fileCard.locator('button[title="Split & Batch"]')
    await expect(splitButton).toBeVisible({ timeout: 5_000 })
    await splitButton.click()

    // Verify dialog is open
    await expect(page.locator('text="Split Audio & Batch Transcribe"')).toBeVisible({ timeout: 5_000 })

    // Try different selectors for the chunks input - use chunk duration instead
    const chunkDurationInput = page.getByLabel(/chunk duration/i)
    await expect(chunkDurationInput).toBeVisible({ timeout: 5_000 })
    await chunkDurationInput.clear()
    await chunkDurationInput.fill('2')  // 2 minutes will create 3 chunks from 5-min file

    // Ensure "Start transcription automatically" is checked
    const autoStartCheckbox = page.getByText('Start transcription automatically').locator('..').locator('input[type="checkbox"]')
    const isChecked = await autoStartCheckbox.isChecked()
    if (!isChecked) {
      await autoStartCheckbox.check()
      console.log('Enabled auto-start transcription')
    } else {
      console.log('Auto-start transcription already enabled')
    }

    const splitConfirmButton = page.getByRole('button', { name: /split.*process/i })
    await splitConfirmButton.click()

    // Wait for split to complete
    await expect(page.getByRole('heading', { name: /split audio/i })).toBeHidden({ timeout: 30_000 })
    await page.waitForTimeout(3000)
    await captureScreenshot(page, '05-after-split')

    // STEP 4: Check state after split - chunks should auto-start transcription 
    console.log('\n[STEP 4] Checking state after file split...')

    states = await getAllFileCardStates(page)
    await printFileStates(states, 'TYPE CHECK 2: After Split')

    expect(states.length, 'Should have 4 files after split (original + 3 chunks)').toBe(4)

    // Wait a bit longer for auto-start to kick in (model might need to load)
    console.log('\n[STEP 4.5] Waiting for auto-start transcription to begin...')
    await page.waitForTimeout(5000)
    
    states = await getAllFileCardStates(page)
    await printFileStates(states, 'TYPE CHECK 2.5: After Auto-Start Wait')

    // Original file should remain unchanged
    expect(states[0].status, 'Original file should be pending').toBe('pending')
    expect(states[0].batchBadge, 'Original file should have no badge').toBeNull()
    expect(states[0].hasStartButton, 'Original file should have start button').toBe(true)

    // Chunk files should be processing (auto-started) with "Batch" badges
    for (let i = 1; i <= 3; i++) {
      const state = states[i]
      expect(state.status, `Chunk ${i} should be processing`).toBe('processing')
      expect(state.batchBadge, `Chunk ${i} should have "Batch" badge`).toBe('Batch')
      // Start button not available when processing
    }

    await captureScreenshot(page, '06-type-check-2-after-split')

    await captureScreenshot(page, '06-after-split-auto-started')

    // STEP 5: Monitor transcription progress (auto-started after split)
    console.log('\n[STEP 5] Monitoring auto-started transcription progress...')    // STEP 6: Enhanced transcription monitoring with detailed progress tracking
    console.log('\n[STEP 6] Monitoring transcription progress with detailed tracking...')
    
    const TRANSCRIPTION_TIMEOUT = 240000 // 4 minutes max for medium model
    const CHECK_INTERVAL = 3000 // Check every 3 seconds for more responsive monitoring
    const startTime = Date.now()
    let completedCount = 0
    let processingCount = 0
    let allCompleted = false
    let progressHistory: Array<{elapsed: number, completed: number, processing: number, pending: number, errors: number}> = []

    while (Date.now() - startTime < TRANSCRIPTION_TIMEOUT && !allCompleted) {
      states = await getAllFileCardStates(page)
      
      // Count states for chunk files only (indices 1, 2, 3)
      const chunkStates = states.slice(1, 4) // Only check chunk files
      completedCount = chunkStates.filter((s: FileCardState) => s.status === 'completed').length
      processingCount = chunkStates.filter((s: FileCardState) => s.status === 'processing').length
      const pendingCount = chunkStates.filter((s: FileCardState) => s.status === 'pending').length
      const errorCount = chunkStates.filter((s: FileCardState) => s.status === 'error').length
      
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      
      // Store progress history for analysis
      progressHistory.push({
        elapsed,
        completed: completedCount,
        processing: processingCount,
        pending: pendingCount,
        errors: errorCount
      })

      console.log(`[${elapsed}s] Progress: ${completedCount}/3 completed, ${processingCount} processing, ${pendingCount} pending, ${errorCount} errors`)
      
      // Check badge states during processing
      chunkStates.forEach((state, index) => {
        // Batch files should show "Batch" badge when processing, not "Processing"
        if (state.status === 'processing' && state.batchBadge !== 'Batch') {
          console.log(`[WARN] Chunk ${index + 1} is processing but badge is "${state.batchBadge}", expected "Batch"`)
        }
        // When completed, batch files should still show "Batch" badge, not "Completed"
        if (state.status === 'completed' && state.batchBadge !== 'Batch') {
          console.log(`[WARN] Chunk ${index + 1} is completed but badge is "${state.batchBadge}", expected "Batch"`)
        }
      })
      
      // Check if all chunks are completed
      if (completedCount === 3) {
        allCompleted = true
        console.log('[PASS] All chunk transcriptions completed!')
        break
      }
      
      // Enhanced stall detection
      if (processingCount === 0 && pendingCount === 0 && completedCount < 3) {
        await printFileStates(states, `ERROR: Transcriptions stopped unexpectedly at ${elapsed}s`)
        throw new Error(`Transcriptions stopped unexpectedly. Completed: ${completedCount}/3, Errors: ${errorCount}`)
      }
      
      // Check for stalled progress (same state for too long)
      if (progressHistory.length >= 10) { // Check last 30 seconds of history
        const recent = progressHistory.slice(-10)
        const noProgress = recent.every(p => p.completed === recent[0].completed && p.processing === recent[0].processing)
        if (noProgress && completedCount < 3) {
          console.log(`[WARN] No progress detected for 30 seconds. Current state: ${completedCount} completed, ${processingCount} processing`)
        }
      }
      
      // Take progress screenshot every 20 seconds
      if (elapsed % 20 === 0) {
        await captureScreenshot(page, `08-progress-${elapsed}s`, `Progress at ${elapsed}s: ${completedCount}/3 completed`)
      }
      
      await page.waitForTimeout(CHECK_INTERVAL)
    }

    // Log progress summary
    console.log('\n[PROGRESS SUMMARY]')
    console.log(`Total monitoring time: ${Math.round((Date.now() - startTime) / 1000)}s`)
    console.log(`Progress checks: ${progressHistory.length}`)
    console.log('Progress timeline:')
    progressHistory.forEach(p => {
      console.log(`  ${p.elapsed}s: ${p.completed}C ${p.processing}P ${p.pending}W ${p.errors}E`)
    })

    if (!allCompleted) {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      await printFileStates(states, `TIMEOUT: After ${elapsed}s`)
      throw new Error(`Transcription timeout after ${elapsed}s. Only ${completedCount}/3 completed.`)
    }

    // STEP 6: Verify final badge states with detailed validation
    console.log('\n[STEP 6] Verifying final batch badge states...')
    
    states = await getAllFileCardStates(page)
    await captureScreenshot(page, '09-final-validation')

    // All 3 chunk files should be completed with proper badges
    for (let i = 1; i <= 3; i++) {
      const state = states[i]
      
      if (state.status !== 'completed') {
        throw new Error(`Chunk file ${i} status is "${state.status}", expected "completed"`)
      }
      // After completion, chunks should still show "Batch" badge (not "Completed")
      if (state.batchBadge !== 'Batch') {
        throw new Error(`Chunk file ${i} batch badge is "${state.batchBadge}", expected "Batch"`)
      }
      
      console.log(`[PASS] Chunk ${i}: Status="${state.status}", Badge="${state.batchBadge}"`)
    }

    // Original file should still be pending
    expect(states[0].status, 'Original file should remain pending').toBe('pending')
    expect(states[0].batchBadge, 'Original file should have no badge').toBeNull()

    await printFileStates(states, 'FINAL VERIFICATION COMPLETE')
    console.log('[PASS] All batch badges verified successfully!')
    
    const totalTime = Math.round((Date.now() - testStartTime) / 1000)
    console.log(`\n[TEST COMPLETE] Total test duration: ${totalTime}s`)
  })
})
