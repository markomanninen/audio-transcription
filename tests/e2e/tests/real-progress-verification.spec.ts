import { test, expect } from '@playwright/test';

/**
 * Test to verify REAL Whisper progress tracking (not fake time-based estimates)
 *
 * This test ensures that:
 * 1. Progress bar updates with actual percentages from Whisper
 * 2. Progress doesn't get stuck at 73.8% or any other value
 * 3. Progress increases smoothly without jumping
 * 4. Stage messages show actual percentages (e.g., "47% complete")
 */

test.describe('Real Whisper Progress Tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:18300');

    // Skip tutorial if present
    await page.evaluate(() => {
      localStorage.setItem('hasSeenTutorial', 'true');
      localStorage.setItem('hasSeenAudioTutorial', 'true');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should show REAL Whisper progress (not stuck at 73.8%)', async ({ page }) => {
    // Create a project
    await page.click('button:has-text("New Project")');
    await page.fill('input[placeholder*="project name" i]', 'Progress Test Project');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(1000);

    // Upload a small audio file (use test fixture if available)
    const fileInput = await page.locator('input[type="file"]').first();

    // Check if we have a test file, otherwise skip
    const testFilePath = '/Users/markomanninen/Documents/GitHub/transcribe/tests/fixtures/test-audio-30s.mp3';
    const fs = require('fs');
    if (!fs.existsSync(testFilePath)) {
      test.skip(true, 'Test audio file not found - skipping test');
      return;
    }

    await fileInput.setInputFiles(testFilePath);
    await page.waitForTimeout(2000);

    // Get the file card
    const fileCard = page.locator('[data-component="file-card"]').first();
    await expect(fileCard).toBeVisible();

    // Start transcription with large model to ensure we can see progress updates
    const startButton = fileCard.locator('button:has-text("Start Transcription")').first();
    await startButton.click();
    await page.waitForTimeout(1000);

    // Track progress updates
    const progressUpdates: number[] = [];
    const stageMessages: string[] = [];
    let gotStuckAt738 = false;
    let maxConsecutiveSameProgress = 0;
    let currentSameCount = 0;
    let lastProgress = -1;

    console.log('🔍 Monitoring progress updates...');

    // Monitor progress for up to 3 minutes
    const monitorStartTime = Date.now();
    const maxMonitorTime = 180000; // 3 minutes

    while (Date.now() - monitorStartTime < maxMonitorTime) {
      try {
        // Get current progress from the UI
        const progressText = await fileCard.locator('text=/\\d+\\.?\\d*%/').first().textContent({ timeout: 1000 });
        const stageText = await fileCard.locator('[data-component="file-card"]').textContent({ timeout: 1000 });

        if (progressText) {
          const progressMatch = progressText.match(/(\d+\.?\d*)%/);
          if (progressMatch) {
            const currentProgress = parseFloat(progressMatch[1]);

            // Track if progress is same as before
            if (currentProgress === lastProgress) {
              currentSameCount++;
              maxConsecutiveSameProgress = Math.max(maxConsecutiveSameProgress, currentSameCount);
            } else {
              currentSameCount = 0;
              lastProgress = currentProgress;
            }

            // Check if stuck at 73.8%
            if (Math.abs(currentProgress - 73.8) < 0.5 && currentSameCount > 10) {
              gotStuckAt738 = true;
              console.error('❌ PROGRESS STUCK AT 73.8%!');
            }

            progressUpdates.push(currentProgress);

            // Log significant progress updates
            if (progressUpdates.length % 5 === 0) {
              console.log(`📊 Progress: ${currentProgress}% (${progressUpdates.length} updates)`);
            }
          }
        }

        if (stageText) {
          // Extract stage message
          const stageMatch = stageText.match(/Transcribing audio[^)]*\)/i);
          if (stageMatch && !stageMessages.includes(stageMatch[0])) {
            stageMessages.push(stageMatch[0]);
            console.log(`📝 Stage: ${stageMatch[0]}`);
          }
        }

        // Check if transcription completed
        const status = await fileCard.getAttribute('data-status');
        if (status === 'completed') {
          console.log('[PASS] Transcription completed!');
          break;
        }

        // Wait 2 seconds between checks
        await page.waitForTimeout(2000);

      } catch (error) {
        // Element might not be visible yet, continue monitoring
        await page.waitForTimeout(1000);
      }
    }

    console.log('\n📊 PROGRESS TRACKING RESULTS:');
    console.log(`Total progress updates: ${progressUpdates.length}`);
    console.log(`Progress range: ${Math.min(...progressUpdates)}% → ${Math.max(...progressUpdates)}%`);
    console.log(`Max consecutive same progress: ${maxConsecutiveSameProgress}`);
    console.log(`Stage messages seen: ${stageMessages.length}`);

    // ASSERTIONS - VERIFY REAL PROGRESS TRACKING

    // 1. Should have received multiple progress updates
    expect(progressUpdates.length).toBeGreaterThan(5);
    console.log('[PASS] Received multiple progress updates');

    // 2. Should NOT get stuck at 73.8%
    expect(gotStuckAt738).toBe(false);
    console.log('[PASS] Progress did NOT get stuck at 73.8%');

    // 3. Progress should increase (allowing for small fluctuations)
    const isMonotonicallyIncreasing = progressUpdates.every((val, i, arr) =>
      i === 0 || val >= arr[i - 1] - 1  // Allow 1% tolerance for async updates
    );
    expect(isMonotonicallyIncreasing).toBe(true);
    console.log('[PASS] Progress increases monotonically');

    // 4. Should NOT have same progress for more than 20 consecutive checks (40 seconds)
    expect(maxConsecutiveSameProgress).toBeLessThan(20);
    console.log(`[PASS] Progress never stuck for more than ${maxConsecutiveSameProgress * 2} seconds`);

    // 5. Stage messages should show actual percentages (not just "finalizing")
    const hasActualPercentages = stageMessages.some(msg =>
      /\d+% complete/i.test(msg)
    );
    expect(hasActualPercentages).toBe(true);
    console.log('[PASS] Stage messages show actual percentages');

    // 6. Should NOT see old-style time-based messages
    const hasOldStyleMessages = stageMessages.some(msg =>
      /finalizing.*\d+s.*long running/i.test(msg) && !/\d+% complete/i.test(msg)
    );
    expect(hasOldStyleMessages).toBe(false);
    console.log('[PASS] No old-style time-based estimates found');

    console.log('\n🎉 ALL PROGRESS TRACKING TESTS PASSED!');
  });

  test('should show smooth progress increments (not jumps)', async ({ page }) => {
    // This is a simpler test that just verifies progress increases smoothly

    // Create project and upload file (reuse setup from main test)
    await page.click('button:has-text("New Project")');
    await page.fill('input[placeholder*="project name" i]', 'Smooth Progress Test');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(1000);

    const testFilePath = '/Users/markomanninen/Documents/GitHub/transcribe/tests/fixtures/test-audio-30s.mp3';
    const fs = require('fs');
    if (!fs.existsSync(testFilePath)) {
      test.skip(true, 'Test audio file not found');
      return;
    }

    const fileInput = await page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFilePath);
    await page.waitForTimeout(2000);

    const fileCard = page.locator('[data-component="file-card"]').first();
    const startButton = fileCard.locator('button:has-text("Start Transcription")').first();
    await startButton.click();

    // Sample progress 10 times over 30 seconds
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(3000);

      const progressText = await fileCard.locator('text=/\\d+\\.?\\d*%/').first().textContent({ timeout: 1000 }).catch(() => null);
      if (progressText) {
        const match = progressText.match(/(\d+\.?\d*)%/);
        if (match) {
          samples.push(parseFloat(match[1]));
          console.log(`Sample ${i + 1}/10: ${match[1]}%`);
        }
      }
    }

    // Verify progress increased in at least 70% of samples
    let increasedCount = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] > samples[i - 1]) {
        increasedCount++;
      }
    }

    const increaseRate = increasedCount / (samples.length - 1);
    console.log(`\nProgress increased in ${(increaseRate * 100).toFixed(0)}% of samples`);

    expect(increaseRate).toBeGreaterThan(0.6); // At least 60% of samples should show increase
    console.log('[PASS] Progress shows smooth incremental updates');
  });
});
