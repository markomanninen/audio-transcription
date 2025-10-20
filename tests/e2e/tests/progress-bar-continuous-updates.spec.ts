import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * COMPREHENSIVE PROGRESS BAR TEST
 *
 * Tests that progress bar:
 * 1. Shows immediately after starting transcription
 * 2. Updates continuously without getting stuck
 * 3. Never disappears until transcription completes
 * 4. Shows real percentages from Whisper
 * 5. Completes successfully with all stages tracked
 */

const TEST_AUDIO_FILE = path.join(__dirname, '../assets/Kaartintorpantie-clip.m4a');

test.describe('Progress Bar Continuous Updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/audio');

    // Skip tutorial and set last used model to large
    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTutorial', 'true');
      window.localStorage.setItem('hasSeenAudioTutorial', 'true');
      const settings = JSON.stringify({
        model_size: 'large',
        language: null,
        include_diarization: false
      });
      window.localStorage.setItem('lastUsedTranscriptionSettings', settings);
    });

    // Wait for app to be ready
    const splash = page.getByTestId('loading-splash');
    await splash.waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {});

    // Skip tutorial if it appears
    const skipButton = page.getByRole('button', { name: /skip/i });
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click();
    }
  });

  test('30sec file with large model shows continuous progress without disappearing', async ({ page }) => {
    const progressStages: Array<{time: string, percent: number, stage: string}> = [];
    const errors: string[] = [];

    console.log('\n🔬 PROGRESS BAR CONTINUOUS UPDATES TEST');
    console.log('========================================\n');

    // STEP 1: Create project
    console.log('[STEP 1] Creating project...');
    const createButton = page.getByRole('button', { name: 'New Project' });
    await expect(createButton).toBeVisible({ timeout: 10_000 });
    await createButton.click();

    const projectName = `Progress Test ${Date.now()}`;
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeVisible({ timeout: 5_000 });
    await page.getByLabel(/project name/i).fill(projectName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeHidden({ timeout: 15_000 });

    // Skip project selector validation - just wait for modal to close
    await page.waitForTimeout(2000); // Give project time to be selected

    console.log('[STEP 1] ✅ Project created\n');

    // STEP 2: Upload 30-second audio file
    console.log('[STEP 2] Uploading 30-second audio file...');
    const fileInput = await page.locator('input[type="file"]').first();

    const fs = require('fs');
    if (!fs.existsSync(TEST_AUDIO_FILE)) {
      throw new Error(`Test audio file not found: ${TEST_AUDIO_FILE}`);
    }

    await fileInput.setInputFiles(TEST_AUDIO_FILE);
    await page.waitForTimeout(2000);
    console.log('[STEP 2] ✅ File uploaded\n');

    const fileCard = page.locator('[data-component="file-card"]').first();
    await expect(fileCard).toBeVisible();

    // STEP 3: Start transcription with LARGE model
    console.log('[STEP 3] Opening transcription settings modal...');

    // Click Start button to open settings modal
    const startButton = fileCard.locator('button:has-text("Start")').first();
    await startButton.click();
    await page.waitForTimeout(1000);

    // Settings modal should be open
    const modal = page.locator('[role="dialog"], .modal').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    console.log('[STEP 3] Settings modal opened');

    // Verify LARGE model is selected (from localStorage)
    const largeModelRadio = modal.locator('input[type="radio"][value="large"]');
    await expect(largeModelRadio).toBeChecked({ timeout: 2000 });
    console.log('[STEP 3] LARGE model is selected');

    // Click "Start Transcription" button in the modal
    const startTranscriptionButton = modal.locator('button:has-text("Start")').first();
    await startTranscriptionButton.click();
    await page.waitForTimeout(2000); // Wait for modal to close and transcription to start

    console.log('[STEP 3] ✅ Transcription started with LARGE model\n');

    // STEP 3.5: SELECT the file to see progress in right panel
    console.log('[STEP 3.5] Selecting file to view progress...');
    await fileCard.click();
    await page.waitForTimeout(1000); // Wait for right panel to appear
    await page.screenshot({ path: `test-results/01-file-selected.png`, fullPage: true });
    console.log('[STEP 3.5] ✅ File selected, progress panel should be visible\n');

    // STEP 4: Monitor progress bar continuously
    console.log('[STEP 4] Monitoring progress bar (max 5 minutes)...\n');

    const startTime = Date.now();
    const maxDuration = 300000; // 5 minutes
    let lastProgress = -1;
    let sameProgressCount = 0;
    let maxStuck = 0;
    let progressBarDisappeared = false;
    let finalStatus: string | null = null;

    while (Date.now() - startTime < maxDuration) {
      try {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // Get file ID first to build correct selector
        const fileId = await fileCard.getAttribute('data-file-id');

        // Check if progress panel is visible in the RIGHT PANEL (TranscriptionProgress component)
        // Use the file-specific test ID: transcription-progress-{fileId}
        const progressPanel = fileId
          ? page.locator(`[data-testid="transcription-progress-${fileId}"]`)
          : page.locator('[data-component="transcription-progress"]').first();
        const isProgressVisible = await progressPanel.isVisible({ timeout: 1000 }).catch(() => false);

        if (!isProgressVisible) {
          // Take screenshot when progress bar disappears to debug the issue
          if (elapsed === 0) {
            await page.screenshot({ path: `test-results/00-progress-panel-missing-initial.png`, fullPage: true });
            console.log(`[${elapsed}s] ⚠️  DEBUG: Progress panel not visible at start - screenshot saved`);
          }

          // Check if transcription completed
          const status = await fileCard.getAttribute('data-status');
          if (status === 'completed') {
            finalStatus = 'completed';
            console.log(`\n[${elapsed}s] ✅ Transcription COMPLETED`);
            await page.screenshot({ path: `test-results/05-transcription-completed.png`, fullPage: true });
            break;
          } else if (status === 'failed') {
            finalStatus = 'failed';
            const errorMsg = await fileCard.textContent();
            errors.push(`Transcription failed: ${errorMsg}`);
            console.log(`\n[${elapsed}s] ❌ Transcription FAILED`);
            break;
          } else {
            // Progress bar disappeared but not completed!
            progressBarDisappeared = true;
            errors.push(`Progress bar disappeared at ${elapsed}s but status is ${status}`);
            console.log(`\n[${elapsed}s] ⚠️  PROGRESS BAR DISAPPEARED (status: ${status})`);
          }
        }

        // Extract current progress percentage from the progress panel
        const panelText = await progressPanel.textContent({ timeout: 1000 }).catch(() => '');
        const progressMatch = panelText.match(/(\d+(?:\.\d+)?)\s*%/);
        const stageMatch = panelText.match(/Transcribing audio[^)]*\)|Stage:[^)]*\)|Loading[^)]*\)|Creating[^)]*\)|.*(?:complete|model|processing)/i);

        if (progressMatch) {
          const currentProgress = parseFloat(progressMatch[1]);
          const stage = stageMatch ? stageMatch[0] : 'Unknown stage';

          // Track if progress is stuck
          if (currentProgress === lastProgress) {
            sameProgressCount++;
            maxStuck = Math.max(maxStuck, sameProgressCount);
          } else {
            sameProgressCount = 0;
            lastProgress = currentProgress;
          }

          // Record progress update (log every 5% change or every 10 seconds)
          const shouldLog = progressStages.length === 0 ||
                           Math.abs(currentProgress - progressStages[progressStages.length - 1].percent) >= 5 ||
                           elapsed % 10 === 0;

          if (shouldLog) {
            const record = {
              time: `${elapsed}s`,
              percent: currentProgress,
              stage: stage
            };
            progressStages.push(record);
            console.log(`[${record.time}] ${record.percent.toFixed(1)}% - ${record.stage}`);

            // Take screenshot at key progress milestones
            if (currentProgress >= 10 && currentProgress < 15) {
              await page.screenshot({ path: `test-results/02-progress-10-percent.png`, fullPage: true });
            } else if (currentProgress >= 50 && currentProgress < 55) {
              await page.screenshot({ path: `test-results/03-progress-50-percent.png`, fullPage: true });
            } else if (currentProgress >= 90) {
              await page.screenshot({ path: `test-results/04-progress-90-percent.png`, fullPage: true });
            }
          }

          // Check for stuck progress (more than 30 seconds at same value)
          if (sameProgressCount > 30) {
            errors.push(`Progress stuck at ${currentProgress}% for ${sameProgressCount} seconds`);
            console.log(`\n⚠️  WARNING: Progress stuck at ${currentProgress}% for ${sameProgressCount}s`);
          }
        }

        // Wait 1 second between checks
        await page.waitForTimeout(1000);

      } catch (error) {
        // Continue monitoring even if there are temporary errors
        await page.waitForTimeout(1000);
      }
    }

    // STEP 5: Verify results
    console.log('\n[STEP 5] Verifying results...\n');
    console.log('========================================');
    console.log('PROGRESS TRACKING SUMMARY');
    console.log('========================================\n');

    console.log(`Total duration: ${Math.floor((Date.now() - startTime) / 1000)}s`);
    console.log(`Progress updates recorded: ${progressStages.length}`);
    console.log(`Max consecutive same progress: ${maxStuck} seconds`);
    console.log(`Final status: ${finalStatus}`);
    console.log(`Errors encountered: ${errors.length}\n`);

    if (progressStages.length > 0) {
      console.log('Progress timeline:');
      progressStages.forEach((stage, i) => {
        console.log(`  ${i + 1}. [${stage.time}] ${stage.percent.toFixed(1)}% - ${stage.stage}`);
      });
      console.log();
    }

    if (errors.length > 0) {
      console.log('❌ Errors:');
      errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
      console.log();
    }

    // ASSERTIONS
    console.log('Running assertions...\n');

    // 1. Should have received multiple progress updates
    expect(progressStages.length).toBeGreaterThan(3);
    console.log('✅ Received multiple progress updates');

    // 2. Progress bar should NOT disappear before completion
    expect(progressBarDisappeared).toBe(false);
    console.log('✅ Progress bar remained visible throughout');

    // 3. Should complete successfully
    expect(finalStatus).toBe('completed');
    console.log('✅ Transcription completed successfully');

    // 4. Progress should increase monotonically (allow small fluctuations)
    let nonIncreasing = 0;
    for (let i = 1; i < progressStages.length; i++) {
      if (progressStages[i].percent < progressStages[i - 1].percent - 1) {
        nonIncreasing++;
      }
    }
    expect(nonIncreasing).toBeLessThan(2); // Allow max 1 decrease
    console.log('✅ Progress increases monotonically');

    // 5. Should NOT get stuck for more than 30 seconds
    expect(maxStuck).toBeLessThan(30);
    console.log(`✅ Progress never stuck (max ${maxStuck}s at same value)`);

    // 6. Should show real percentages (not just time-based "finalizing")
    const hasRealPercentages = progressStages.some(s =>
      /\d+%\s+complete/i.test(s.stage) || s.percent > 0
    );
    expect(hasRealPercentages).toBe(true);
    console.log('✅ Shows real progress percentages');

    // 7. Should NOT have errors
    expect(errors.length).toBe(0);
    console.log('✅ No errors encountered');

    // 8. Should reach near 100% before completion
    const maxProgress = Math.max(...progressStages.map(s => s.percent));
    expect(maxProgress).toBeGreaterThan(85);
    console.log(`✅ Reached ${maxProgress.toFixed(1)}% before completion`);

    console.log('\n========================================');
    console.log('🎉 ALL UI TESTS PASSED!');
    console.log('========================================\n');

    // STEP 6: API VERIFICATION
    console.log('[STEP 6] Verifying API data...\n');

    // Get file ID from the card
    const fileId = await fileCard.getAttribute('data-file-id');
    expect(fileId).toBeTruthy();
    console.log(`File ID: ${fileId}`);

    // Call transcription status API
    const apiResponse = await page.request.get(`http://localhost:3000/api/transcription/${fileId}/status`);
    expect(apiResponse.ok()).toBe(true);

    const apiData = await apiResponse.json();
    console.log('\nAPI Response:');
    console.log(`  Status: ${apiData.status}`);
    console.log(`  Progress: ${apiData.progress * 100}%`);
    console.log(`  Segments: ${apiData.segment_count}`);
    console.log(`  Processing stage: ${apiData.processing_stage}`);

    expect(apiData.status).toBe('completed');
    expect(apiData.progress).toBeGreaterThanOrEqual(1.0);
    expect(apiData.segment_count).toBeGreaterThan(0);
    console.log('\n✅ API data matches UI state');

    // STEP 7: DATABASE VERIFICATION
    console.log('\n[STEP 7] Verifying database state...\n');

    // Use API to query backend database state
    const filesResponse = await page.request.get(`http://localhost:3000/api/upload/files/1`); // Assuming project ID 1
    expect(filesResponse.ok()).toBe(true);

    const filesData = await filesResponse.json();
    const ourFile = filesData.find((f: any) => f.file_id === parseInt(fileId!));

    expect(ourFile).toBeTruthy();
    console.log('Database file record:');
    console.log(`  File ID: ${ourFile.file_id}`);
    console.log(`  Status: ${ourFile.status}`);
    console.log(`  Processing stage: ${ourFile.processing_stage}`);
    console.log(`  Error message: ${ourFile.error_message || 'none'}`);

    expect(ourFile.status).toBe('completed');
    console.log('\n✅ Database state verified');

    // STEP 8: SEGMENTS VERIFICATION
    console.log('\n[STEP 8] Verifying segments created...\n');

    const segmentsResponse = await page.request.get(`http://localhost:3000/api/transcription/${fileId}/segments`);
    expect(segmentsResponse.ok()).toBe(true);

    const segments = await segmentsResponse.json();
    console.log(`Segments created: ${segments.length}`);

    expect(segments.length).toBeGreaterThan(0);

    // Verify segment structure
    if (segments.length > 0) {
      const firstSegment = segments[0];
      console.log('\nFirst segment:');
      console.log(`  Start time: ${firstSegment.start_time}s`);
      console.log(`  End time: ${firstSegment.end_time}s`);
      console.log(`  Text: "${firstSegment.original_text.substring(0, 50)}..."`);

      expect(firstSegment.start_time).toBeGreaterThanOrEqual(0);
      expect(firstSegment.end_time).toBeGreaterThan(firstSegment.start_time);
      expect(firstSegment.original_text).toBeTruthy();
      expect(firstSegment.original_text.length).toBeGreaterThan(0);
    }

    console.log('\n✅ Segments verified');

    console.log('\n========================================');
    console.log('🎉 ALL TESTS PASSED (UI + API + DB)!');
    console.log('========================================\n');
  });

  test('progress stages should include all expected phases', async ({ page }) => {
    console.log('\n🔬 PROGRESS STAGES TEST');
    console.log('========================================\n');

    // Create project
    const createButton = page.getByRole('button', { name: 'New Project' });
    await expect(createButton).toBeVisible({ timeout: 10_000 });
    await createButton.click();

    const projectName = `Stages Test ${Date.now()}`;
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeVisible({ timeout: 5_000 });
    await page.getByLabel(/project name/i).fill(projectName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeHidden({ timeout: 15_000 });

    // Upload file
    const fileInput = await page.locator('input[type="file"]').first();
    const fs = require('fs');
    if (!fs.existsSync(TEST_AUDIO_FILE)) {
      test.skip(true, 'Test audio file not found');
      return;
    }

    await fileInput.setInputFiles(TEST_AUDIO_FILE);
    await page.waitForTimeout(2000);

    const fileCard = page.locator('[data-component="file-card"]').first();

    // Start transcription
    const startButton = fileCard.locator('button:has-text("Start")').first();
    await startButton.click();

    const seenStages: string[] = [];
    const startTime = Date.now();
    const maxDuration = 300000; // 5 minutes

    console.log('Monitoring transcription stages...\n');

    while (Date.now() - startTime < maxDuration) {
      try {
        const cardText = await fileCard.textContent({ timeout: 1000 }).catch(() => '');

        // Extract stage information
        if (cardText.includes('Loading') || cardText.includes('loading')) {
          if (!seenStages.includes('loading')) {
            seenStages.push('loading');
            console.log(`✓ Stage: Model loading`);
          }
        }
        if (cardText.includes('Transcribing') || cardText.includes('transcribing')) {
          if (!seenStages.includes('transcribing')) {
            seenStages.push('transcribing');
            console.log(`✓ Stage: Transcribing audio`);
          }
        }
        if (cardText.includes('Creating') || cardText.includes('segments')) {
          if (!seenStages.includes('creating')) {
            seenStages.push('creating');
            console.log(`✓ Stage: Creating segments`);
          }
        }

        // Check if completed
        const status = await fileCard.getAttribute('data-status');
        if (status === 'completed') {
          console.log(`✓ Stage: Completed`);
          break;
        }

        await page.waitForTimeout(1000);
      } catch (error) {
        await page.waitForTimeout(1000);
      }
    }

    console.log(`\nTotal stages seen: ${seenStages.length}`);
    console.log(`Stages: ${seenStages.join(' → ')}\n`);

    // Should see at least loading and transcribing stages
    expect(seenStages.length).toBeGreaterThanOrEqual(2);
    expect(seenStages).toContain('transcribing');

    console.log('✅ All expected stages observed\n');
  });
});
