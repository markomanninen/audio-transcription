import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_AUDIO_FILE = path.resolve(__dirname, 'fixtures/test-audio-30s.mp3');
const TRANSCRIPTION_TIMEOUT = 180_000; // 3 minutes is ample for tiny model

const parseProgress = (value: string | null): number => {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

async function prepareAudioWorkspace(page: Page) {
  await page.goto('/audio');

  await page.evaluate(() => {
    const settings = JSON.stringify({
      model_size: 'tiny',
      language: null,
      include_diarization: false,
    });
    localStorage.setItem('hasSeenTutorial', 'true');
    localStorage.setItem('hasSeenAudioTutorial', 'true');
    localStorage.setItem('lastUsedTranscriptionSettings', settings);
    localStorage.setItem('defaultTranscriptionSettings', settings);
  });

  await page.getByTestId('loading-splash').waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {});

  const skipButton = page.getByRole('button', { name: /skip/i });
  if (await skipButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await skipButton.click();
  }
}

async function createAudioProject(page: Page, name: string) {
  const createButton = page.getByRole('button', { name: /new project|create audio project/i }).first();
  await expect(createButton).toBeVisible({ timeout: 10_000 });
  await createButton.click();

  const modalHeading = page.getByRole('heading', { name: /create new project/i });
  await expect(modalHeading).toBeVisible({ timeout: 5_000 });

  const nameInput = page.getByLabel(/project name/i);
  await nameInput.fill(name);

  await page.getByRole('button', { name: /^create$/i }).click();
  await expect(modalHeading).toBeHidden({ timeout: 15_000 });

  await page
    .waitForFunction(
      () => {
        const select = document.querySelector('select');
        return select && /^\d+$/.test(select.value);
      },
      null,
      { timeout: 15_000 }
    )
    .catch(() => {});
}

async function uploadTestFile(page: Page) {
  if (!fs.existsSync(TEST_AUDIO_FILE)) {
    throw new Error(`Test audio file not found at ${TEST_AUDIO_FILE}`);
  }

  const fileInput = page.locator('input[type="file"]').first();
  await expect(fileInput).toBeVisible({ timeout: 5_000 });
  await fileInput.setInputFiles(TEST_AUDIO_FILE);

  const fileCard = page.locator('[data-component="file-card"]').first();
  await expect(fileCard).toBeVisible({ timeout: 20_000 });
  return fileCard;
}

async function startTranscription(page: Page, fileCard: Locator) {
  const startButton = fileCard.locator('button:has-text("Start")').first();
  await expect(startButton).toBeVisible({ timeout: 5_000 });
  await startButton.click();

  const modal = page.locator('[role="dialog"], .modal').first();
  await expect(modal).toBeVisible({ timeout: 5_000 });

  const confirmButton = modal.locator('button:has-text("Start")').first();
  await expect(confirmButton).toBeVisible({ timeout: 5_000 });
  await confirmButton.click();
  await expect(modal).toBeHidden({ timeout: 10_000 });

  await expect
    .poll(async () => (await fileCard.getAttribute('data-status')) ?? '', { timeout: 30_000 })
    .toMatch(/processing|completed/);

  await fileCard.click();
  const fileId = await fileCard.getAttribute('data-file-id');
  if (!fileId) {
    throw new Error('File card missing data-file-id attribute');
  }

  const progressPanel = page.locator(`[data-testid="transcription-progress-${fileId}"]`);
  await expect(progressPanel).toBeVisible({ timeout: 10_000 });
  return progressPanel;
}

test.describe('Progress Bar Continuous Updates', () => {
  test.beforeEach(async ({ page }) => {
    await prepareAudioWorkspace(page);
  });

  test('progress panel stays visible and reaches completion', async ({ page }) => {
    await createAudioProject(page, `Progress Test ${Date.now()}`);
    const fileCard = await uploadTestFile(page);
    const progressPanel = await startTranscription(page, fileCard);

    const observedProgress = new Set<number>();
    observedProgress.add(parseProgress(await progressPanel.getAttribute('data-progress')));

    await expect
      .poll(async () => {
        const value = parseProgress(await progressPanel.getAttribute('data-progress'));
        observedProgress.add(value);
        return value;
      }, { timeout: TRANSCRIPTION_TIMEOUT, message: 'Progress should exceed 0%' })
      .toBeGreaterThan(0);

    await expect(progressPanel).toBeVisible();

    await expect
      .poll(async () => {
        const status = (await fileCard.getAttribute('data-status')) ?? '';
        const value = parseProgress(await progressPanel.getAttribute('data-progress'));
        observedProgress.add(value);
        return status;
      }, { timeout: TRANSCRIPTION_TIMEOUT, message: 'Transcription should complete' })
      .toBe('completed');

    await expect(progressPanel).toBeVisible();
    const finalProgress = parseProgress(await progressPanel.getAttribute('data-progress'));
    expect(finalProgress).toBeGreaterThanOrEqual(100);
    expect(observedProgress.size).toBeGreaterThanOrEqual(2);
  });

  test('transcription shows stage updates before completion', async ({ page }) => {
    await createAudioProject(page, `Stages Test ${Date.now()}`);
    const fileCard = await uploadTestFile(page);
    const progressPanel = await startTranscription(page, fileCard);

    const seenStages = new Set<string>();
    const start = Date.now();

    while (Date.now() - start < TRANSCRIPTION_TIMEOUT) {
      const text = await progressPanel.textContent().catch(() => '');
      if (text) {
        if (/loading/i.test(text)) {
          seenStages.add('loading');
        }
        if (/transcribing/i.test(text)) {
          seenStages.add('transcribing');
        }
        if (/segment|creating/i.test(text)) {
          seenStages.add('segments');
        }
      }

      const status = await fileCard.getAttribute('data-status');
      if (status === 'completed') {
        break;
      }
      await page.waitForTimeout(1_000);
    }

    expect(seenStages.has('transcribing')).toBeTruthy();

    await expect
      .poll(async () => (await fileCard.getAttribute('data-status')) ?? '', { timeout: TRANSCRIPTION_TIMEOUT })
      .toBe('completed');

    const finalProgress = parseProgress(await progressPanel.getAttribute('data-progress'));
    expect(finalProgress).toBeGreaterThanOrEqual(100);
  });
});
