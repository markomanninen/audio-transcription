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
import { 
  skipTutorialIfPresent, 
  createTestProject, 
  waitForProjectReady, 
  changeAIModel,
  getLLMLogs,
  makeApiRequest
} from '../helpers/test-helpers';
import { getEnvironmentConfig, getTimeouts } from '../helpers/environment';

test.describe('AI Model Selection', () => {
  test.beforeEach(async () => {
    // Log environment configuration at start of each test
    const config = getEnvironmentConfig();
    console.log(`🏃‍♂️ Running AI Model Selection test in ${config.environment} environment`);
    console.log(`   Frontend: ${config.urls.frontend}`);
    console.log(`   Backend: ${config.urls.backend}`);
  });

  test('should use selected 3b model for AI corrections and log correctly', async ({ page }) => {
    const timeouts = getTimeouts();
    
    // Navigate to the application
    await page.goto('/');
    await skipTutorialIfPresent(page);

    // Create a new project with test audio
    await createTestProject(page, 'AI Model Test Project');
    
    // Wait for project to be ready with environment-appropriate timeout
    await waitForProjectReady(page);

    // Change AI model from default (1b) to 3b
    await changeAIModel(page, 'llama3.2:3b');

    // Verify localStorage was updated
    const storedModel = await page.evaluate(() => {
      return localStorage.getItem('ollama_model');
    });
    expect(storedModel).toBe('llama3.2:3b');

    // Find a segment to correct
    const firstSegment = page.locator('[data-testid="segment-item"]').first();
    await expect(firstSegment).toBeVisible({ timeout: timeouts.default });
    
    // Open segment actions menu
    await firstSegment.locator('[data-testid="segment-actions-menu"]').click();
    
    // Click AI Correct option
    await page.locator('[data-testid="ai-correct-option"]').click();
    
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

  test('should handle model selection for batch corrections', async ({ page }) => {
    const timeouts = getTimeouts();
    
    // Navigate to the application
    await page.goto('/');
    await skipTutorialIfPresent(page);

    // Create a project with multiple segments
    await createTestProject(page, 'Batch AI Test Project');
    await waitForProjectReady(page);

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
        });

        // Apply all corrections if available
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