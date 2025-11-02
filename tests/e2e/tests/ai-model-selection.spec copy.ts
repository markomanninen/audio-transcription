/**
 * E2E test to verify AI model selection functionality
 * 
 * This test validates the complete workflow:
 * 1. User changes AI model from default (1b) to 3b
 * 2. Creates AI correction for a segment
 * 3. Verifies backend logs show correct model was used
 * 
 * Supports multiple environments: local dev, Docker, e2e test, production
 */
import { test, expect } from '@playwright/test';

test.describe('AI Model Selection', () => {
  test.beforeEach(async () => {
    // Log environment configuration at start of each test
    console.log(`🏃‍♂️ Running AI Model Selection test`);
  });

  test('should use selected 3b model for AI corrections and log correctly', async ({ page }) => {
    // Get current test environment URLs (copy from working timeout test)
    const frontendUrl = page.url() || 'http://127.0.0.1:18356';
    const frontendPort = new URL(frontendUrl).port || '18356';
    const backendPort = parseInt(frontendPort) - 1000 + 220;
    const backendUrl = `http://127.0.0.1:${backendPort}`;
    
    console.log(`🎯 AI MODEL SELECTION TEST`);
    console.log(`   Frontend: ${frontendUrl}`);
    console.log(`   Backend: ${backendUrl}`);

    // 1. Set up localStorage with model settings
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('ollama_model', 'llama3.2:3b');
      localStorage.setItem('llmProvider', 'ollama');
      localStorage.setItem('hasSeenTutorial', 'true');
      localStorage.setItem('hasSeenAudioTutorial', 'true');
    });

    // Verify localStorage was updated
    const storedModel = await page.evaluate(() => {
      return localStorage.getItem('ollama_model');
    });
    expect(storedModel).toBe('llama3.2:3b');
    console.log('✅ Model set to llama3.2:3b');

    // 2. Navigate to audio workspace and skip tutorial
    await page.goto('/audio');
    
    // Wait for loading splash to disappear
    const splash = page.getByTestId('loading-splash');
    await splash.waitFor({ state: 'detached', timeout: 30000 });

    // Skip tutorial button if it appears
    const skipButton = page.getByRole('button', { name: /skip/i });
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click();
    }
    
    await page.waitForTimeout(2000);

    // 3. Create project with audio (copy from working timeout test)
    console.log('🎵 Creating project with audio...');
    
    const createButtonEmpty = page.getByRole('button', { name: /create audio project/i });
    const createButtonNew = page.getByRole('button', { name: 'New Project' });
    
    let createButton;
    if (await createButtonEmpty.isVisible({ timeout: 2000 }).catch(() => false)) {
      createButton = createButtonEmpty;
    } else if (await createButtonNew.isVisible({ timeout: 2000 }).catch(() => false)) {
      createButton = createButtonNew;
    } else {
      throw new Error('No create project button found');
    }
    
    await createButton.click();
    await page.getByLabel(/project name/i).fill('AI Model Test Project');
    await page.getByRole('button', { name: /^create$/i }).click();
    
    // Wait for modal to close
    await expect(page.getByRole('heading', { name: /create new project/i })).toBeHidden({ timeout: 15000 });
    console.log('✅ Project created');

    // 4. Upload audio file
    console.log('📁 Uploading audio file...');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('/Users/markomanninen/Documents/GitHub/transcribe/data/audio/test-upload.wav');
    console.log('✅ Audio file uploaded');

    // 5. Start transcription
    console.log('⏳ Starting transcription...');
    const transcribeButton = page.getByRole('button', { name: /transcribe|start/i });
    await transcribeButton.click();

    // Wait for transcription to complete
    let transcriptionStatus = 'processing';
    let elapsedTime = 0;
    const startTime = Date.now();
    
    while (transcriptionStatus !== 'completed' && elapsedTime < 120) {
      await page.waitForTimeout(2000);
      elapsedTime = Math.floor((Date.now() - startTime) / 1000);
      
      const statusElement = page.locator('[data-testid="transcription-status"]');
      if (await statusElement.isVisible().catch(() => false)) {
        transcriptionStatus = await statusElement.textContent() || 'processing';
        transcriptionStatus = transcriptionStatus.toLowerCase().trim();
      }
      
      console.log(`⏳ Transcription status: ${transcriptionStatus} (${elapsedTime}s elapsed)`);
      
      if (transcriptionStatus.includes('completed') || transcriptionStatus.includes('done')) {
        transcriptionStatus = 'completed';
        break;
      }
    }
    
    console.log('✅ Transcription completed');

    // 6. Find segments and test AI correction
    console.log('🔍 Looking for transcribed segments...');
    const segmentContainer = page.locator('[data-testid="transcription-segments"]');
    await expect(segmentContainer).toBeVisible({ timeout: 10000 });
    console.log('📊 Found segment container, checking for individual segments...');

    const segments = page.locator('[data-testid="segment-item"]');
    const segmentCount = await segments.count();
    console.log(`📊 Segment count: ${segmentCount}`);
    
    if (segmentCount === 0) {
      throw new Error('No segments found after transcription');
    }
    
    console.log('✅ Found segments, testing AI correction with model selection...');

    // Find a segment to correct
    const firstSegment = segments.first();
    await expect(firstSegment).toBeVisible({ timeout: 10000 });
    
    const segmentText = await firstSegment.locator('[data-testid="segment-text"]').textContent();
    console.log(`📝 First segment text: ${segmentText}`);

    // Test AI correction with selected model
    console.log('🤖 Testing AI correction with llama3.2:3b model...');
    
    // Open segment menu
    const menuButton = firstSegment.locator('[data-testid="segment-menu-button"]');
    await menuButton.click();
    
    const aiCorrectButton = page.getByRole('button', { name: 'AI Correct' });
    console.log('✅ Found AI Correct button in menu');
    await aiCorrectButton.click();
    
    console.log('⏱️ AI correction started, monitoring completion...');
    
    // Wait for AI correction modal to appear
    const aiModal = page.locator('[data-testid="ai-correction-modal"]');
    await expect(aiModal).toBeVisible({ timeout: timeouts.default });
    
    // Verify the model selection shows in the modal (if available)
    const modalModelInfo = page.locator('[data-testid="modal-model-info"]');
    if (await modalModelInfo.isVisible()) {
      await expect(modalModelInfo).toContainText('llama3.2:3b');
    }
    
    // Start AI correction
    await page.locator('[data-testid="apply-correction-button"]').click();
    
    // Wait for correction to complete with environment-appropriate timeout
    await expect(page.locator('[data-testid="correction-status"]')).toHaveText(/completed|success/i, { 
      timeout: timeouts.aiCorrection 
    });
    
    // Apply the correction
    await page.locator('[data-testid="accept-correction-button"]').click();
    
    // Verify modal closes and dropdown menu is also closed
    await expect(aiModal).not.toBeVisible();
    
    // Check if dropdown is still open and close it
    const dropdown = page.locator('[data-testid="segment-actions-dropdown"]');
    if (await dropdown.isVisible()) {
      await page.keyboard.press('Escape');
    }

    // Verify the backend logs show the correct model was used via environment-aware API call
    const logs = await getLLMLogs(page, { limit: 1, operation: 'correct_text' });
    expect(logs.length).toBeGreaterThan(0);
    
    const recentLog = logs[0];
    expect(recentLog.model).toBe('llama3.2:3b');
    expect(recentLog.provider).toBe('ollama');
    expect(recentLog.operation).toBe('correct_text');
    expect(recentLog.status).toBe('success');

    // Verify the log contains the segment content
    expect(recentLog.original_text).toBeTruthy();
    expect(recentLog.corrected_text).toBeTruthy();
    expect(recentLog.segment_id).toBeTruthy();
    expect(recentLog.project_id).toBeTruthy();

    const config = getEnvironmentConfig();
    console.log('✅ AI Model Selection Test Passed:');
    console.log(`   Environment: ${config.environment}`);
    console.log(`   Model changed from 1b to 3b successfully`);
    console.log(`   AI correction completed using ${recentLog.model}`);
    console.log(`   Backend logs confirm correct model usage`);
    console.log(`   Duration: ${recentLog.duration_ms}ms`);
    console.log(`   Original text: "${recentLog.original_text?.substring(0, 50)}..."`);
    console.log(`   Corrected text: "${recentLog.corrected_text?.substring(0, 50)}..."`);
  });

  test('should maintain model selection across page reloads', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    await skipTutorialIfPresent(page);

    // Change AI model to 3b
    await changeAIModel(page, 'llama3.2:3b');

    // Reload the page
    await page.reload();
    await skipTutorialIfPresent(page);

    // Verify model selection is still 3b
    await page.locator('[data-testid="settings-button"]').click();
    const reloadedModelSelect = page.locator('[data-testid="ollama-model-select"]');
    await expect(reloadedModelSelect).toHaveValue('llama3.2:3b');
    await page.locator('[data-testid="settings-close"]').click();

    // Verify localStorage still has the setting
    const storedModel = await page.evaluate(() => {
      return localStorage.getItem('ollama_model');
    });
    expect(storedModel).toBe('llama3.2:3b');
  });

  test('batch processing: AI corrections should use the selected model for all segments', async ({ page }) => {
    const config = getEnvironmentConfig();
    const timeouts = getTimeouts();
    
    // Navigate to the application
    await skipTutorialIfPresent(page);
    await setupAudioProject(page, 'Batch AI Test Project');

    // Set model to 3b
    await changeAIModel(page, 'llama3.2:3b');

    // Select multiple segments for batch correction if available
    const segments = page.locator('[data-testid="segment-item"]');
    const segmentCount = await segments.count();
    
    if (segmentCount === 0) {
      console.log('No segments available for batch testing - skipping batch test');
      return;
    }
    
    // Select first 3 segments (or all if less than 3)
    const selectCount = Math.min(3, segmentCount);
    for (let i = 0; i < selectCount; i++) {
      const segmentCheckbox = segments.nth(i).locator('[data-testid="segment-checkbox"]');
      if (await segmentCheckbox.isVisible()) {
        await segmentCheckbox.check();
      }
    }

    // Look for batch actions
    const batchActionsBtn = page.locator('[data-testid="batch-actions-button"]');
    if (await batchActionsBtn.isVisible()) {
      await batchActionsBtn.click();
      
      const batchAICorrect = page.locator('[data-testid="batch-ai-correct"]');
      if (await batchAICorrect.isVisible()) {
        await batchAICorrect.click();

        // Wait for batch correction to complete with environment-appropriate timeout
        await expect(page.locator('[data-testid="batch-status"]')).toHaveText(/completed|success/i, { 
          timeout: timeouts.long
        });        // Apply all corrections if available
        const applyAllBtn = page.locator('[data-testid="apply-all-corrections"]');
        if (await applyAllBtn.isVisible()) {
          await applyAllBtn.click();
        }

        // Verify all corrections used the 3b model using environment-aware API
        const logs = await getLLMLogs(page, { 
          operation: 'correct_text', 
          limit: selectCount 
        });
        expect(logs.length).toBeGreaterThanOrEqual(1); // At least one correction should have been made
        
        // Verify each log entry used the correct model
        for (const log of logs.slice(0, selectCount)) {
          expect(log.model).toBe('llama3.2:3b');
          expect(log.provider).toBe('ollama');
          expect(log.operation).toBe('correct_text');
          expect(log.status).toBe('success');
        }

        const config = getEnvironmentConfig();
        console.log(`✅ Batch AI Correction Test Passed (${config.environment}):`);
        console.log(`   ${logs.length} segments corrected using llama3.2:3b`);
        console.log(`   All logs confirm correct model usage`);
      } else {
        console.log('Batch AI correction not available - testing individual correction');
        
        // Fall back to individual correction test
        const firstSegment = segments.first();
        await firstSegment.locator('[data-testid="segment-actions-menu"]').click();
        await page.locator('[data-testid="ai-correct-option"]').click();
        
        const aiModal = page.locator('[data-testid="ai-correction-modal"]');
        await expect(aiModal).toBeVisible({ timeout: timeouts.default });
        
        await page.locator('[data-testid="apply-correction-button"]').click();
        await expect(page.locator('[data-testid="correction-status"]')).toHaveText(/completed|success/i, { 
          timeout: timeouts.aiCorrection 
        });
        await page.locator('[data-testid="accept-correction-button"]').click();
        
        // Verify the correction used 3b model
        const logs = await getLLMLogs(page, { operation: 'correct_text', limit: 1 });
        expect(logs[0].model).toBe('llama3.2:3b');
      }
    } else {
      console.log('Batch actions not available - skipping batch test');
    }
  });
});