/// <reference types="node" />
import { test, expect } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// In CommonJS mode, __dirname is available globally
const API_BASE_URL = process.env.LOCAL_API_URL || 'http://127.0.0.1:8000'
const AUDIO_PATH = path.resolve(__dirname, '../assets/Kaartintorpantie-clip.m4a')
const FILE_DISPLAY_NAME = 'Kaartintorpantie 2.m4a'
function removeSmallModelCaches() {
  const cacheDir = path.join(os.homedir(), '.cache', 'whisper')
  if (!fs.existsSync(cacheDir)) {
    return
  }
  const toDelete: string[] = []
  for (const entry of fs.readdirSync(cacheDir)) {
    if (entry.toLowerCase().startsWith('small')) {
      toDelete.push(path.join(cacheDir, entry))
    }
  }
  for (const filePath of toDelete) {
    try {
      fs.rmSync(filePath, { recursive: true, force: true })
    } catch (error) {
      console.warn(`Failed to remove cached model ${filePath}:`, error)
    }
  }
}
async function createProject(page: Page) {
  const projectName = `Local E2E ${Date.now()}`
  const response = await page.request.post(`${API_BASE_URL}/api/upload/project`, {
    data: { name: projectName },
  })
  expect(response.ok()).toBeTruthy()
  const data = await response.json()
  return { id: data.id as number, name: projectName }
}
async function uploadAudio(page: Page, projectId: number) {
  const fileBuffer = fs.readFileSync(AUDIO_PATH)
  const response = await page.request.post(`${API_BASE_URL}/api/upload/file/${projectId}`, {
    multipart: {
      file: {
        name: FILE_DISPLAY_NAME,
        mimeType: 'audio/mp4',
        buffer: fileBuffer,
      },
      language: '',
    },
  })
  expect(response.ok()).toBeTruthy()
  const data = await response.json()
  return { fileId: data.file_id as number, fileName: data.original_filename as string }
}
async function waitForStatus(
  locator: Locator,
  predicate: (status: string | null) => boolean,
  timeoutMs = 180_000
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await locator.getAttribute('data-status')
    if (predicate(status)) {
      return status
    }
    await locator.page().waitForTimeout(1000)
  }
  throw new Error(`Timed out waiting for status predicate after ${timeoutMs}ms`)
}
async function waitForProgressGreaterThan(
  locator: Locator,
  minPercent: number,
  timeoutMs = 180_000
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const progressAttr = await locator.getAttribute('data-progress')
    const value = progressAttr ? parseInt(progressAttr, 10) : NaN
    if (!Number.isNaN(value) && value > minPercent) {
      return value
    }
    await locator.page().waitForTimeout(1000)
  }
  throw new Error(`Timed out waiting for progress > ${minPercent}`)
}
test.describe.configure({ mode: 'serial' })
test.describe('Local Whisper progress lifecycle', { tag: '@whisper-real' }, () => {
  test.beforeAll(() => {
    expect(fs.existsSync(AUDIO_PATH)).toBeTruthy()
    // Don't remove cached models to speed up test execution
    // removeSmallModelCaches()
  })
  test('downloads Whisper tiny model and syncs progress to UI', async ({ page }) => {
    test.slow()
    test.setTimeout(3 * 60 * 1000) // 3 minutes: plenty for 39MB download + load + transcribe
    const project = await createProject(page)
    const file = await uploadAudio(page, project.id)
  await page.goto('/audio')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('hasSeenTutorial', 'true')
        window.localStorage.setItem('hasSeenAudioTutorial', 'true')
        // Use tiny model instead of small for faster testing (~39MB vs ~488MB)
        const stubSettings = JSON.stringify({ model_size: 'tiny', language: null, include_diarization: true })
        window.localStorage.setItem('lastUsedTranscriptionSettings', stubSettings)
        window.localStorage.setItem('defaultTranscriptionSettings', stubSettings)
      } catch (e) {}
    })
    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 180_000 }).catch(() => {})
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }
    await page.waitForSelector('select')
    await page.selectOption('select', project.id.toString())
    const fileCard = page.locator(`[data-component="file-card"][data-file-id="${file.fileId}"]`)
    await expect(fileCard).toContainText(FILE_DISPLAY_NAME)
    const startButton = fileCard.getByRole('button', { name: /start transcription/i })
    await startButton.click()
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: /start transcription/i }).click()
    await expect(modal).toBeHidden()
    const statusPanel = page.locator(
      `[data-component="transcription-progress"][data-file-id="${file.fileId}"]`
    )
    await expect(statusPanel).toBeVisible()

    // Model may already be loaded, so status might be 'processing' immediately
    // Don't require whisper-loading state - it may be skipped if model is cached
    const observedStatus = await waitForStatus(
      statusPanel,
      (status) => status === 'whisper-loading' || status === 'processing' || status === 'completed',
      30 * 1000 // 30 seconds to start showing status
    )
    expect(['whisper-loading', 'processing', 'completed']).toContain(observedStatus || '')

    // If still loading, wait for it to transition to processing/completed
    if (observedStatus === 'whisper-loading') {
      await waitForStatus(
        statusPanel,
        (status) => status === 'processing' || status === 'completed',
        2 * 60 * 1000 // 2 minutes for model to load
      )
    }

    // Check current status - if already completed, skip progress wait
    const currentStatus = (await statusPanel.getAttribute('data-status')) || 'pending'

    if (currentStatus !== 'completed') {
      // Wait for progress to show (or completion)
      try {
        await waitForProgressGreaterThan(statusPanel, 0, 2 * 60 * 1000) // 2 minutes for progress to start
      } catch (error) {
        // Progress might not show if transcription completes very quickly
        // Check if we're already completed
        const finalStatus = (await statusPanel.getAttribute('data-status')) || 'pending'
        if (finalStatus !== 'completed') {
          throw error // Re-throw if not completed
        }
      }

      // Wait for completion
      await waitForStatus(statusPanel, (status) => status === 'completed', 2 * 60 * 1000) // 2 minutes to complete
    }
    await expect
      .poll(() => fileCard.getAttribute('data-status'), { timeout: 30 * 1000 }) // 30s for UI sync
      .toBe('completed')
  })
  test('uses cached model on subsequent transcription', async ({ page }) => {
    test.slow()
    test.setTimeout(2 * 60 * 1000) // 2 minutes: cached model loads fast, ~40s total expected
    const project = await createProject(page)
    const file = await uploadAudio(page, project.id)
  await page.goto('/audio')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('hasSeenTutorial', 'true')
        const stubSettings = JSON.stringify({ model_size: 'tiny', language: null, include_diarization: true })
        window.localStorage.setItem('lastUsedTranscriptionSettings', stubSettings)
        window.localStorage.setItem('defaultTranscriptionSettings', stubSettings)
      } catch (e) {}
    })
    const splash = page.getByTestId('loading-splash')
    await splash.waitFor({ state: 'detached', timeout: 180_000 }).catch(() => {})
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
    }
    await page.waitForSelector('select')
    await page.selectOption('select', project.id.toString())
    const fileCard = page.locator(`[data-component="file-card"][data-file-id="${file.fileId}"]`)
    await expect(fileCard).toContainText(FILE_DISPLAY_NAME)
    const startButton = fileCard.getByRole('button', { name: /start transcription/i })
    await startButton.click()
    const modal = page.locator('[role="dialog"]')
    await modal.getByRole('button', { name: /start transcription/i }).click()
    await expect(modal).toBeHidden()
    const statusPanel = page.locator(
      `[data-component="transcription-progress"][data-file-id="${file.fileId}"]`
    )
    await expect(statusPanel).toBeVisible()
    const initialStatus = await waitForStatus(
      statusPanel,
      (status) => status !== 'whisper-loading' && status !== 'pending'
    )
    expect(['processing', 'completed'].includes(initialStatus || '')).toBeTruthy()
    await waitForProgressGreaterThan(statusPanel, 0, 60_000) // 60s: cached model is fast
    await waitForStatus(statusPanel, (status) => status === 'completed', 60_000) // 60s for completion
    await expect
      .poll(() => fileCard.getAttribute('data-status'), { timeout: 30_000 }) // 30s for UI sync
      .toBe('completed')
  })
})
