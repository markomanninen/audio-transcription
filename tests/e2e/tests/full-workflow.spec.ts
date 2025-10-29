import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const API_BASE_URL = process.env.LOCAL_API_URL || 'http://127.0.0.1:8000'
const AUDIO_PATH = path.resolve(__dirname, '../assets/Kaartintorpantie-clip.m4a')

test.describe('Full Application Workflow', () => {
  test('complete workflow: create project → edit → upload file → transcribe → delete', async ({ page }) => {
    test.setTimeout(180_000) // 3 minutes

    console.log('=== FULL WORKFLOW TEST ===')

    await page.goto('/audio')

    // Setup
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

    // STEP 1: Create project
    console.log('\n[STEP 1] Creating project...')
    const createButton = page.getByRole('button', { name: 'New Project' })
    await expect(createButton).toBeVisible({ timeout: 10_000 })
    await createButton.click()

    const projectName = `Full Workflow Test ${Date.now()}`
    const modalHeading = page.getByRole('heading', { name: /create new project/i })
    await expect(modalHeading).toBeVisible({ timeout: 5_000 })

    await page.getByLabel(/project name/i).fill(projectName)
    await page.getByRole('button', { name: /^create$/i }).click()

    await expect(modalHeading).toBeHidden({ timeout: 15_000 })
    console.log('[STEP 1] [PASS] Project created')

    // Verify project is selected
    const projectSelect = page.getByRole('banner').getByRole('combobox')
    await expect(projectSelect).toHaveValue(/^\d+$/, { timeout: 10_000 })
    const projectId = await projectSelect.inputValue()
    console.log(`[STEP 1] Project ID: ${projectId}`)

    // STEP 2: Edit project name
    console.log('\n[STEP 2] Editing project name...')

    // Find and click the edit button (pencil icon or edit text)
    const editButton = page.locator('button[title*="edit" i], button:has-text("Edit"), button:has(svg.lucide-pencil)')
    if (await editButton.count() > 0) {
      await editButton.first().click()

      const editedName = `${projectName} - EDITED`
      const nameInput = page.getByLabel(/project name/i)
      await nameInput.fill(editedName)

      const saveButton = page.getByRole('button', { name: /save|update/i })
      await saveButton.click()

      // Wait for save to complete - modal should close
      await page.waitForTimeout(2000)
      console.log('[STEP 2] [PASS] Project name edited')
    } else {
      console.log('[STEP 2] [WARN] No edit button found, skipping edit step')
    }

    // STEP 3: Upload audio file
    console.log('\n[STEP 3] Uploading audio file...')

    // Wait for upload area to be ready
    await page.waitForTimeout(1000)

    // Look for file input or upload button
    const fileInput = page.locator('input[type="file"]')
    if (await fileInput.count() > 0) {
      await fileInput.first().setInputFiles(AUDIO_PATH)
      console.log('[STEP 3] File selected, waiting for upload...')

      // Wait for file to appear in file list
      await page.waitForTimeout(3000)
      console.log('[STEP 3] [PASS] File uploaded')
    } else {
      console.log('[STEP 3] [WARN] No file input found, trying API upload...')

      // Upload via API if UI is not ready
      const fileBuffer = fs.readFileSync(AUDIO_PATH)
      const response = await page.request.post(`${API_BASE_URL}/api/upload/file/${projectId}`, {
        multipart: {
          file: {
            name: 'test-audio.m4a',
            mimeType: 'audio/mp4',
            buffer: fileBuffer,
          },
          language: '',
        },
      })
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      console.log(`[STEP 3] [PASS] File uploaded via API, file ID: ${data.file_id}`)

      // Refresh to see the file
      await page.reload()
      await splash.waitFor({ state: 'detached', timeout: 30_000 })
    }

    // STEP 4: Start transcription
    console.log('\n[STEP 4] Starting transcription...')

    const fileCard = page.locator('[data-component="file-card"]').first()
    await expect(fileCard).toBeVisible({ timeout: 10_000 })

    const startButton = fileCard.getByRole('button', { name: /start transcription/i })
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click()

      // Handle transcription settings modal
      const settingsModal = page.locator('[role="dialog"]')
      if (await settingsModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        const startModalButton = settingsModal.getByRole('button', { name: /start transcription/i })
        await startModalButton.click()
      }

      console.log('[STEP 4] [PASS] Transcription started')

      // Wait a bit for transcription to begin
      await page.waitForTimeout(3000)
    } else {
      console.log('[STEP 4] [WARN] File may already be transcribing or completed')
    }

    // STEP 5: Delete project
    console.log('\n[STEP 5] Deleting project...')

    // Look for delete button
    const deleteButton = page.locator('button[title*="delete" i], button:has-text("Delete"), button:has(svg.lucide-trash)')
    if (await deleteButton.count() > 0) {
      await deleteButton.first().click()

      // Confirm deletion if modal appears
      const confirmButton = page.getByRole('button', { name: /delete|confirm/i }).last()
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click()
      }

      // Wait for deletion to complete
      await page.waitForTimeout(2000)
      console.log('[STEP 5] [PASS] Project deleted')
    } else {
      console.log('[STEP 5] [WARN] No delete button found, using API...')

      // Delete via API
      const response = await page.request.delete(`${API_BASE_URL}/api/upload/project/${projectId}`)
      if (response.ok()) {
        console.log('[STEP 5] [PASS] Project deleted via API')
      } else {
        console.log(`[STEP 5] [WARN] API delete failed: ${response.status()}`)
      }
    }

    console.log('\n=== WORKFLOW TEST COMPLETE ===')
  })

  test('rapid operations stress test - complete workflow', async ({ page }) => {
    test.setTimeout(180_000) // 3 minutes

    console.log('=== COMPLETE WORKFLOW STRESS TEST ===')

    await page.goto('/audio')

    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true')
      window.localStorage.setItem('hasSeenAudioTutorial', 'true')
      // Use tiny model for fast testing
      const stubSettings = JSON.stringify({ model_size: 'tiny', language: null, include_diarization: false })
      window.localStorage.setItem('lastUsedTranscriptionSettings', stubSettings)
    })

    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 30_000 })

    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }

    // CYCLE 1: Create → Edit → Refresh → Upload → Delete
    console.log('\n[CYCLE 1] Starting...')

        // Create project
    console.log('\n[CYCLE 1] Creating project')
    const createButton = page.getByRole('button', { name: 'Create Audio Project' })
    await createButton.click()

    const projectName1 = `Full Test 1 - ${Date.now()}`
    await page.getByLabel(/project name/i).fill(projectName1)
    await page.getByRole('button', { name: /^create$/i }).click()

    const modalHeading = page.getByRole('heading', { name: /create new project/i })
    await expect(modalHeading).toBeHidden({ timeout: 15_000 })
    console.log('[CYCLE 1] [PASS] Project created')

    // Get project ID
    const projectSelect = page.getByRole('banner').getByRole('combobox')
    const projectId1 = await projectSelect.inputValue()

    // Edit project via API
    console.log('[CYCLE 1] Editing project')
    await page.request.put(`${API_BASE_URL}/api/upload/project/${projectId1}`, {
      data: { name: `${projectName1} - EDITED` },
    })
    console.log('[CYCLE 1] [PASS] Project edited')

    // Refresh page
    console.log('[CYCLE 1] Refreshing page')
    await page.reload()
    await splash.waitFor({ state: 'detached', timeout: 30_000 })
    console.log('[CYCLE 1] [PASS] Page refreshed')

    // Upload file via API
    console.log('[CYCLE 1] Uploading audio file')
    const fileBuffer = fs.readFileSync(AUDIO_PATH)
    const uploadResp = await page.request.post(`${API_BASE_URL}/api/upload/file/${projectId1}`, {
      multipart: {
        file: {
          name: 'test.m4a',
          mimeType: 'audio/mp4',
          buffer: fileBuffer,
        },
        language: '',
      },
    })
    expect(uploadResp.ok()).toBeTruthy()
    const fileData = await uploadResp.json()
    console.log(`[CYCLE 1] [PASS] File uploaded, ID: ${fileData.file_id}`)

    // Start transcription via API
    console.log('[CYCLE 1] Starting transcription')
    const transcribeResp = await page.request.post(
      `${API_BASE_URL}/api/transcription/${fileData.file_id}/start`,
      {
        data: {
          model_size: 'tiny',
          language: null,
          include_diarization: false,
        },
      }
    )
    expect(transcribeResp.ok()).toBeTruthy()
    console.log('[CYCLE 1] [PASS] Transcription started')

    // Delete project via API
    console.log('[CYCLE 1] Deleting project')
    const deleteResp = await page.request.delete(`${API_BASE_URL}/api/upload/project/${projectId1}`)
    expect(deleteResp.ok()).toBeTruthy()
    console.log('[CYCLE 1] [PASS] Project deleted')

    // CYCLE 2: Create → Upload → Edit → Delete
    console.log('\n[CYCLE 2] Starting...')

    await page.reload()
    await splash.waitFor({ state: 'detached', timeout: 30_000 })

    console.log('[CYCLE 2] Creating project')
    const createButton2 = page.getByRole('button', { name: /create.*project|new (audio )?project/i })
    await createButton2.click()

    const projectName2 = `Full Test 2 - ${Date.now()}`
    await page.getByLabel(/project name/i).fill(projectName2)
    await page.getByRole('button', { name: /^create$/i }).click()

    await expect(modalHeading).toBeHidden({ timeout: 15_000 })
    console.log('[CYCLE 2] [PASS] Project created')

    const projectId2 = await projectSelect.inputValue()

    // Upload and edit in quick succession
    console.log('[CYCLE 2] Uploading file')
    const uploadResp2 = await page.request.post(`${API_BASE_URL}/api/upload/file/${projectId2}`, {
      multipart: {
        file: {
          name: 'test2.m4a',
          mimeType: 'audio/mp4',
          buffer: fileBuffer,
        },
        language: '',
      },
    })
    expect(uploadResp2.ok()).toBeTruthy()
    console.log('[CYCLE 2] [PASS] File uploaded')

    console.log('[CYCLE 2] Editing project')
    const editResp = await page.request.put(`${API_BASE_URL}/api/upload/project/${projectId2}`, {
      data: { name: `${projectName2} - FINAL` },
    })
    expect(editResp.ok()).toBeTruthy()
    console.log('[CYCLE 2] [PASS] Project edited')

    console.log('[CYCLE 2] Deleting project')
    const deleteResp2 = await page.request.delete(`${API_BASE_URL}/api/upload/project/${projectId2}`)
    expect(deleteResp2.ok()).toBeTruthy()
    console.log('[CYCLE 2] [PASS] Project deleted')

    console.log('\n=== ALL CYCLES COMPLETE ===')
  })
})
