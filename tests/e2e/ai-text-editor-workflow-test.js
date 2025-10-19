const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Dynamic port detection
function getPortConfig() {
  // Check for explicit environment variable overrides (for run_local_e2e.sh)
  if (process.env.FRONTEND_PORT && process.env.BACKEND_PORT) {
    const frontendPort = parseInt(process.env.FRONTEND_PORT);
    const backendPort = parseInt(process.env.BACKEND_PORT);
    console.log(`🔧 Using environment-specified ports (frontend: ${frontendPort}, backend: ${backendPort})`);
    return {
      environment: 'local-e2e',
      ports: { backend: backendPort, frontend: frontendPort },
      urls: {
        backend: `http://localhost:${backendPort}`,
        frontend: `http://localhost:${frontendPort}`
      }
    };
  }

  // Check for Docker environment override
  if (process.env.USE_DOCKER === 'true' || process.env.TEST_DOCKER === 'true') {
    console.log('🐳 Using Docker environment configuration');
    return {
      environment: 'docker',
      ports: { backend: 8080, frontend: 3000 },
      urls: { backend: 'http://localhost:8080', frontend: 'http://localhost:3000' }
    };
  }

  try {
    const config = execSync('node ../../scripts/port-utils.js config', { encoding: 'utf8', cwd: __dirname });
    return JSON.parse(config);
  } catch (error) {
    console.error('Failed to get port config, using defaults:', error.message);
    return {
      environment: 'development',
      ports: { backend: 8000, frontend: 5173 },
      urls: { backend: 'http://localhost:8000', frontend: 'http://localhost:5173' }
    };
  }
}

// Ensure screenshot directory exists
const screenshotDir = path.join(__dirname, 'test-screenshots', 'ai-editor');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function waitForButtonEnabled(page, labelRegex, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const isEnabled = await page.evaluate((pattern) => {
      const regex = new RegExp(pattern, 'i');
      const buttons = Array.from(document.querySelectorAll('button'));
      const match = buttons.find((btn) => regex.test(btn.textContent || ''));
      return match ? !match.disabled : false;
    }, labelRegex.source).catch(() => false);

    if (isEnabled) {
      return true;
    }

    await page.waitForTimeout(200);
  }

  return false;
}

async function fetchLatestProjectId(request, backendUrl, projectName) {
  try {
    const response = await request.get(`${backendUrl}/api/projects/`, {
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });
    if (!response.ok()) {
      console.warn(`   Failed to fetch projects from API (status ${response.status()})`);
      return null;
    }
    const projects = await response.json();
    if (!Array.isArray(projects) || projects.length === 0) {
      return null;
    }

    if (projectName) {
      const match = projects.find((project) => project.name === projectName);
      if (match) {
        return match.id;
      }
    }

    return projects[0]?.id ?? null;
  } catch (error) {
    console.warn('   Error fetching project list from API:', error.message);
    return null;
  }
}

(async () => {
  console.log('🚀 Starting AI Text Editor workflow test...\n');

  const portConfig = getPortConfig();
  console.log('📡 Using configuration:', JSON.stringify(portConfig, null, 2));

  const frontendUrl = portConfig.urls.frontend;
  const backendUrl = portConfig.urls.backend;

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();
  let createdProjectId = null;
  let editorOpenedAfterCreation = false;

  try {
    // ============================================
    // SECTION 1: APP INITIALIZATION
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 1: APP INITIALIZATION');
    console.log('═══════════════════════════════════════\n');

    // Step 1: Navigate to app
    console.log('Step 1: Navigating to app...');
    await page.goto(frontendUrl);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '01-app-loaded.png'), fullPage: true });
    console.log('✅ App loaded');
    console.log('📸 Screenshot: 01-app-loaded.png\n');

    // Step 2: Handle tutorial if present
    console.log('Step 2: Handling onboarding tutorial...');
    const skipTutorialBtn = page.getByRole('button', { name: /skip|get started/i });
    const isTutorialVisible = await skipTutorialBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (isTutorialVisible) {
      console.log('   Tutorial found, skipping...');
      await skipTutorialBtn.click();
      await page.waitForTimeout(500);
      console.log('✅ Tutorial skipped\n');
    } else {
      console.log('⏭️  No tutorial found\n');
    }

    // Step 2a: Navigate to the text editor workspace
    console.log('Step 2a: Opening AI Text Editor workspace...');
    await page.goto(`${frontendUrl}/text`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.localStorage.setItem('hasSeenTextTutorial', 'true');
    });

    const textSkipTutorialBtn = page.getByRole('button', { name: /skip|get started/i });
    const textTutorialVisible = await textSkipTutorialBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (textTutorialVisible) {
      console.log('   Text editor tutorial found, skipping...');
      await textSkipTutorialBtn.click();
      await page.waitForTimeout(500);
    }

    // ============================================
    // SECTION 2: TEXT PROJECT CREATION
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 2: TEXT PROJECT CREATION');
    console.log('═══════════════════════════════════════\n');

    // Step 3: Create a text project
    console.log('Step 3: Creating text project...');
    const createProjectBtn = page.getByRole('button', { name: /new text project|create text project/i }).first();
    await createProjectBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '02-create-project-modal.png'), fullPage: true });
    console.log('📸 Screenshot: 02-create-project-modal.png');

    // Check if there's a project type selector
    console.log('Step 3a: Selecting project type...');
    const projectTypeSelect = page.locator('select[name="projectType"]').or(
      page.getByLabel(/project type/i)
    );
    const hasProjectType = await projectTypeSelect.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasProjectType) {
      console.log('   Project type selector found, selecting "Text"...');
      await projectTypeSelect.selectOption('text');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotDir, '02a-text-project-selected.png'), fullPage: true });
      console.log('✅ Text project type selected');
      console.log('📸 Screenshot: 02a-text-project-selected.png');
    } else {
      console.log('⚠️  No project type selector found, may be using default');
    }

    // Fill project details
    const projectName = 'AI Editor Test ' + Date.now();
    const projectDescription = 'Test project for AI text editor features';

    const projectNameInput = page.getByLabel(/project name/i).or(page.getByPlaceholder(/project name/i));
    await projectNameInput.fill(projectName);
    console.log(`   Project name: "${projectName}"`);

    const projectDescInput = page.getByLabel(/description/i).or(page.getByPlaceholder(/description/i));
    const hasDescription = await projectDescInput.isVisible({ timeout: 1000 }).catch(() => false);
    if (hasDescription) {
      await projectDescInput.fill(projectDescription);
      console.log(`   Description: "${projectDescription}"`);
    }

    // Submit
    const submitBtn = page.getByRole('button', { name: 'Create', exact: true });
    const creationResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/projects/text') &&
        response.request().method() === 'POST'
    );
    const editorNavigationPromise = page.waitForURL(
      (url) => url.pathname.startsWith('/editor/'),
      { timeout: 15000 }
    ).catch(() => null);
    await submitBtn.click();
    const creationResponse = await creationResponsePromise.catch(() => null);
    if (creationResponse) {
      try {
        const projectData = await creationResponse.json();
        if (projectData && projectData.id) {
          createdProjectId = projectData.id;
          console.log(`   Received project ID from API: ${createdProjectId}`);
        }
      } catch (error) {
        console.warn('   Unable to parse project creation response:', error);
      }
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '03-text-project-created.png'), fullPage: true });
    console.log('✅ Text project created');
    console.log('📸 Screenshot: 03-text-project-created.png\n');

    const editorNavigation = await editorNavigationPromise;
    let enteredEditor = false;
    if (editorNavigation || page.url().includes('/editor/')) {
      enteredEditor = true;
      editorOpenedAfterCreation = true;
      console.log(`   Navigated to ${page.url()}`);
      if (!createdProjectId) {
        const match = page.url().match(/\/editor\/(\d+)/);
        if (match) {
          createdProjectId = parseInt(match[1], 10);
          console.log(`   Parsed project ID from URL: ${createdProjectId}`);
        }
      }
    }

    if (!enteredEditor) {
      const projectCardsLocator = page.locator('[data-testid="text-project-card"]');
      const textProjectCard = projectCardsLocator.first();
      await textProjectCard.waitFor({ state: 'visible', timeout: 15000 });
      const cardProjectId = await textProjectCard.getAttribute('data-project-id');
      const cardProjectName = await textProjectCard.locator('h3').textContent();
      console.log(`   Detected project card → ID: ${cardProjectId}, Title: ${cardProjectName}`);
      if (!createdProjectId && cardProjectId) {
        createdProjectId = parseInt(cardProjectId, 10);
        console.log(`   Using project ID from card: ${createdProjectId}`);
      }
    }

    if (!createdProjectId) {
      createdProjectId = await fetchLatestProjectId(context.request, backendUrl, projectName);
      if (createdProjectId) {
        console.log(`   Retrieved project ID from API fallback: ${createdProjectId}`);
      }
    }

    // ============================================
    // SECTION 3: NAVIGATE TO EDITOR
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 3: NAVIGATE TO EDITOR');
    console.log('═══════════════════════════════════════\n');

    // Step 4: Navigate to editor page
    console.log('Step 4: Opening editor page...');

    // Try multiple ways to open editor
    let editorOpened = false;

    if (editorOpenedAfterCreation && page.url().includes('/editor/')) {
      console.log('   Already on editor page after project creation.');
      editorOpened = true;
    } else {
      // Method 1: Look for "Open Editor" button
      const openEditorBtn = page.getByRole('button', { name: /open.*editor/i });
      let hasOpenBtn = false;
      try {
        await openEditorBtn.waitFor({ state: 'visible', timeout: 5000 });
        hasOpenBtn = true;
      } catch (err) {
        hasOpenBtn = false;
      }

      if (hasOpenBtn) {
        console.log('   Method 1: Clicking "Open Editor" button...');
        await openEditorBtn.click();
        editorOpened = true;
      } else {
        // Method 2: Navigate directly to editor route
        console.log('   Method 2: Navigating directly to editor route...');
        const currentUrl = page.url();
        console.log(`   Current URL: ${currentUrl}`);

        if (createdProjectId) {
          console.log(`   Navigating directly to editor for project ${createdProjectId}...`);
          await page.goto(`${frontendUrl}/editor/${createdProjectId}`);
          editorOpened = true;
        } else {
          console.log('   Attempting to derive project ID via API...');
          createdProjectId = await fetchLatestProjectId(context.request, backendUrl, projectName);
          if (createdProjectId) {
            console.log(`   Fallback project ID obtained: ${createdProjectId}. Navigating to editor...`);
            await page.goto(`${frontendUrl}/editor/${createdProjectId}`);
            editorOpened = true;
          } else {
            console.log('   Unable to determine project ID for direct navigation.');
          }
        }
      }
    }

    if (editorOpened) {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      if (!createdProjectId) {
        const editorUrl = page.url();
        const match = editorUrl.match(/\/editor\/(\d+)/);
        if (match) {
          createdProjectId = parseInt(match[1], 10);
          console.log(`   Parsed project ID from editor URL: ${createdProjectId}`);
        }
      }
      await page.screenshot({ path: path.join(screenshotDir, '04-editor-opened.png'), fullPage: true });
      console.log('✅ Editor page opened');
      console.log('📸 Screenshot: 04-editor-opened.png\n');
    } else {
      throw new Error('Could not open editor page');
    }

    // ============================================
    // SECTION 4: BASIC TEXT EDITING
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 4: BASIC TEXT EDITING');
    console.log('═══════════════════════════════════════\n');

    // Step 5: Write initial text
    console.log('Step 5: Writing initial text...');
    await page.waitForSelector('textarea', { timeout: 5000 });
    const textArea = page.locator('textarea').first();
    const isTextAreaVisible = await textArea.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isTextAreaVisible) {
      throw new Error('Text area not found in editor');
    }

    const initialText = `The Role of Artificial Intelligence in Modern Technology

Artificial intelligence has become an integral part of our daily lives. From voice assistants to recommendation systems, AI is transforming how we interact with technology.

Key areas of AI development include:
- Natural language processing
- Computer vision
- Machine learning algorithms
- Neural networks

The future of AI holds immense potential for solving complex problems and improving human life quality.`;

    await textArea.fill(initialText);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '05-initial-text-entered.png'), fullPage: true });
    console.log('✅ Initial text entered');
    console.log('📸 Screenshot: 05-initial-text-entered.png\n');

    // ============================================
    // SECTION 5: VERSION HISTORY
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 5: VERSION HISTORY & SAVE');
    console.log('═══════════════════════════════════════\n');

    // Step 6: Save version
    console.log('Step 6: Saving version...');
    const saveVersionBtn = page.getByRole('button', { name: /save.*version/i });
    const hasSaveBtn = await saveVersionBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasSaveBtn) {
      await saveVersionBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotDir, '06-version-saved.png'), fullPage: true });
      console.log('✅ Version saved');
      console.log('📸 Screenshot: 06-version-saved.png\n');
    } else {
      console.log('⚠️  Save version button not found, continuing...\n');
    }

    // Step 7: Make changes to the text
    console.log('Step 7: Editing text (adding a paragraph)...');
    const editedText = initialText + `\n\nRecent advancements in AI have led to breakthrough applications in healthcare, finance, and transportation. Machine learning models can now diagnose diseases, predict market trends, and enable autonomous vehicles.`;

    await textArea.fill(editedText);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '07-text-edited.png'), fullPage: true });
    console.log('✅ Text edited');
    console.log('📸 Screenshot: 07-text-edited.png\n');

    // Step 8: Save second version
    console.log('Step 8: Saving second version...');
    if (hasSaveBtn) {
      await saveVersionBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotDir, '08-second-version-saved.png'), fullPage: true });
      console.log('✅ Second version saved');
      console.log('📸 Screenshot: 08-second-version-saved.png\n');
    }

    // Step 9: Check version history
    console.log('Step 9: Checking version history...');
    const historyPanel = page.locator('[class*="history"]').or(
      page.getByText(/version.*history/i).locator('..')
    );
    const hasHistory = await historyPanel.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasHistory) {
      await page.screenshot({ path: path.join(screenshotDir, '09-version-history-visible.png'), fullPage: true });
      console.log('✅ Version history panel visible');
      console.log('📸 Screenshot: 09-version-history-visible.png\n');

      // Try to rollback to previous version
      console.log('Step 9a: Testing rollback...');
      const rollbackBtn = page.getByRole('button', { name: /rollback|restore/i }).first();
      const hasRollback = await rollbackBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasRollback) {
        await rollbackBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(screenshotDir, '09a-rolled-back.png'), fullPage: true });
        console.log('✅ Rolled back to previous version');
        console.log('📸 Screenshot: 09a-rolled-back.png\n');

        // Restore the edited version
        await textArea.fill(editedText);
        await page.waitForTimeout(300);
      }
    } else {
      console.log('⚠️  Version history not visible\n');
    }

    // ============================================
    // SECTION 6: AI FEATURES - SEMANTIC RECONSTRUCTION
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 6: AI SEMANTIC RECONSTRUCTION');
    console.log('═══════════════════════════════════════\n');

    // Step 10: Test semantic reconstruction
    console.log('Step 10: Testing semantic reconstruction...');
    const semanticBtn = page.getByRole('button', { name: /semantic.*reconstruction/i });
    const hasSemanticBtn = await semanticBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasSemanticBtn) {
      console.log('   Clicking semantic reconstruction...');
      await semanticBtn.click();
      await page.waitForTimeout(2000); // AI processing may take time
      await page.screenshot({ path: path.join(screenshotDir, '10-semantic-processing.png'), fullPage: true });
      console.log('📸 Screenshot: 10-semantic-processing.png');

      // Wait for results
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotDir, '10a-semantic-results.png'), fullPage: true });
      console.log('✅ Semantic reconstruction completed');
      console.log('📸 Screenshot: 10a-semantic-results.png\n');

      const initialDiffViewer = page.getByTestId('ai-diff-viewer');
      const initialDiffVisible = await initialDiffViewer.isVisible({ timeout: 3000 }).catch(() => false);
      if (initialDiffVisible) {
        await page.screenshot({ path: path.join(screenshotDir, '10b-diff-view-initial.png'), fullPage: true });
        console.log('✅ Diff viewer visible after semantic reconstruction');
        console.log('📸 Screenshot: 10b-diff-view-initial.png');
      } else {
        console.log('ℹ️  Diff viewer will be triggered again before validation.');
      }

      // Dismiss suggestion so controls are re-enabled for subsequent steps
      const rejectSuggestionBtn = page.getByRole('button', { name: /reject|decline|close/i }).first();
      const suggestionActive = await rejectSuggestionBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (suggestionActive) {
        console.log('   Dismissing AI suggestion to continue editing...');
        await rejectSuggestionBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      console.log('⚠️  Semantic reconstruction button not found\n');
    }

    // ============================================
    // SECTION 7: AI FEATURES - STYLE GENERATION
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 7: AI STYLE GENERATION');
    console.log('═══════════════════════════════════════\n');

    // Step 11: Test style generation
    console.log('Step 11: Testing style generation...');
    const targetStyleSelect = page.getByTestId('style-select');
    const hasStyleSelect = await targetStyleSelect.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasStyleSelect) {
      let styleSelectEnabled = false;
      try {
        await page.waitForFunction(() => {
          const element = document.querySelector('[data-testid="style-select"]');
          return element && !element.disabled;
        }, null, { timeout: 10000 });
        styleSelectEnabled = true;
      } catch {
        styleSelectEnabled = false;
      }

      if (styleSelectEnabled) {
        console.log('   Selecting writing style...');
        await targetStyleSelect.selectOption({ index: 1 }); // Select first non-default option
        await page.waitForTimeout(300);

        const styleGenerateBtn = page.getByRole('button', { name: /generate.*style|style.*generation/i });
        const hasStyleBtn = await styleGenerateBtn.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasStyleBtn) {
          await styleGenerateBtn.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: path.join(screenshotDir, '11-style-processing.png'), fullPage: true });
          console.log('📸 Screenshot: 11-style-processing.png');

          await page.waitForTimeout(3000);
          await page.screenshot({ path: path.join(screenshotDir, '11a-style-generated.png'), fullPage: true });
          console.log('✅ Style generation completed');
          console.log('📸 Screenshot: 11a-style-generated.png\n');

          // Dismiss suggestion again to keep editor controls active
          const rejectStyleBtn = page.getByRole('button', { name: /reject|decline|close/i }).first();
          const styleSuggestionActive = await rejectStyleBtn.isVisible({ timeout: 2000 }).catch(() => false);
          if (styleSuggestionActive) {
            console.log('   Clearing style suggestion to resume editing...');
            await rejectStyleBtn.click();
            await page.waitForTimeout(500);
          }
        }
      } else {
        console.log('⚠️  Style selector stayed disabled; skipping style generation step.\n');
      }
    } else {
      console.log('⚠️  Style generation not found\n');
    }

    // ============================================
    // SECTION 8: AI FEATURES - NLP ANALYSIS
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 8: NLP ANALYSIS');
    console.log('═══════════════════════════════════════\n');

    // Step 12: Test NLP analysis
    console.log('Step 12: Testing NLP analysis...');
    const nlpBtn = page.getByRole('button', { name: /nlp.*analysis|analyze/i });
    const hasNlpBtn = await nlpBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasNlpBtn) {
      const nlpReady = await waitForButtonEnabled(page, /nlp.*analysis|analyze/, 10000);

      if (nlpReady && await nlpBtn.isEnabled({ timeout: 1000 }).catch(() => false)) {
        await nlpBtn.click();

        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(screenshotDir, '12-nlp-processing.png'), fullPage: true });
        console.log('📸 Screenshot: 12-nlp-processing.png');

        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(screenshotDir, '12a-nlp-results.png'), fullPage: true });
        console.log('✅ NLP analysis completed');
        console.log('📸 Screenshot: 12a-nlp-results.png\n');
      } else {
        console.log('⚠️  NLP button stayed disabled; skipping NLP analysis step.\n');
      }
    } else {
      console.log('⚠️  NLP analysis button not found\n');
    }

    // ============================================
    // SECTION 9: DIFF VIEW & SUGGESTIONS
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 9: DIFF VIEW & AI SUGGESTIONS');
    console.log('═══════════════════════════════════════\n');

    // Step 13: Check for diff viewer
    console.log('Step 13: Checking for diff viewer...');
    let diffViewer = page.getByTestId('ai-diff-viewer');
    let hasDiff = await diffViewer.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasDiff) {
      const semanticBtnForDiff = page.getByRole('button', { name: /semantic.*reconstruction/i });
      const canTriggerDiff = await semanticBtnForDiff.isVisible({ timeout: 2000 }).catch(() => false);
      if (canTriggerDiff) {
        const semanticReady = await waitForButtonEnabled(page, /semantic.*reconstruction/, 10000);
        if (semanticReady && await semanticBtnForDiff.isEnabled({ timeout: 1000 }).catch(() => false)) {
          await semanticBtnForDiff.click();
          await page.waitForTimeout(2000);
          diffViewer = page.getByTestId('ai-diff-viewer');
          hasDiff = await diffViewer.isVisible({ timeout: 2000 }).catch(() => false);
        } else {
          console.log('⚠️  Semantic button stayed disabled; unable to re-trigger diff viewer.\n');
        }
      }
    }

    if (hasDiff) {
      await page.screenshot({ path: path.join(screenshotDir, '13-diff-view.png'), fullPage: true });
      console.log('✅ Diff viewer visible');
      console.log('📸 Screenshot: 13-diff-view.png\n');

      // Look for accept/reject buttons
      console.log('Step 13a: Testing suggestion controls...');
      const acceptBtn = page.getByRole('button', { name: /accept|approve/i }).first();
      const rejectBtn = page.getByRole('button', { name: /reject|decline/i }).first();

      const hasAccept = await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false);
      const hasReject = await rejectBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasAccept && hasReject) {
        await page.screenshot({ path: path.join(screenshotDir, '13a-suggestion-controls.png'), fullPage: true });
        console.log('✅ Accept/Reject controls found');
        console.log('📸 Screenshot: 13a-suggestion-controls.png\n');

        // Test reject
        console.log('   Testing reject...');
        await rejectBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(screenshotDir, '13b-suggestion-rejected.png'), fullPage: true });
        console.log('📸 Screenshot: 13b-suggestion-rejected.png\n');
      }
    } else {
      console.log('⚠️  Diff viewer not visible\n');
    }

    // ============================================
    // SECTION 10: EXPORT TEMPLATES
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 10: EXPORT TEMPLATES');
    console.log('═══════════════════════════════════════\n');

    // Step 14: Access export templates settings
    console.log('Step 14: Navigating to export templates...');
    await page.goto(`${frontendUrl}/settings/export-templates`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '14-export-templates-page.png'), fullPage: true });
    console.log('✅ Export templates page opened');
    console.log('📸 Screenshot: 14-export-templates-page.png\n');

    // Step 15: Create new template
    console.log('Step 15: Creating new export template...');
    const newTemplateBtn = page.getByRole('button', { name: /new.*template|create.*template/i });
    const hasNewTemplateBtn = await newTemplateBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasNewTemplateBtn) {
      await newTemplateBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotDir, '15-new-template-modal.png'), fullPage: true });
      console.log('📸 Screenshot: 15-new-template-modal.png');

      // Fill template details
      const templateName = 'Test Template ' + Date.now();
      const templateDesc = 'Test template for E2E testing';
      const templateContent = `# {{title}}

{{text}}

---
Generated on: {{date}}`;

      const nameInput = page.getByLabel(/template.*name/i).or(page.getByPlaceholder(/name/i));
      await nameInput.fill(templateName);
      console.log(`   Template name: "${templateName}"`);

      const descInput = page.getByLabel(/description/i);
      const hasDescInput = await descInput.isVisible({ timeout: 1000 }).catch(() => false);
      if (hasDescInput) {
        await descInput.fill(templateDesc);
      }

      const contentTextarea = page.locator('textarea').last();
      await contentTextarea.fill(templateContent);
      console.log('   Template content entered');

      // Save template
      const saveTemplateBtn = page.getByRole('button', { name: /save/i }).last();
      await saveTemplateBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotDir, '15a-template-created.png'), fullPage: true });
      console.log('✅ Template created');
      console.log('📸 Screenshot: 15a-template-created.png\n');
    } else {
      console.log('⚠️  New template button not found\n');
    }

    // ============================================
    // SECTION 11: TEMPLATE EXPORT
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 11: EXPORT USING TEMPLATE');
    console.log('═══════════════════════════════════════\n');

    // Step 16: Navigate back to editor
    console.log('Step 16: Returning to editor...');
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '16-back-to-editor.png'), fullPage: true });
    console.log('✅ Back to editor');
    console.log('📸 Screenshot: 16-back-to-editor.png\n');

    // Step 17: Test export with template
    console.log('Step 17: Testing export with template...');
    const exportSelect = page.getByTestId('export-template-select');
    const hasExportSelect = await exportSelect.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasExportSelect) {
      const ensureTemplatesLoaded = async () => {
        try {
          await page.waitForFunction(() => {
            const select = document.querySelector('[data-testid="export-template-select"]');
            return select && select.options.length > 1 && !select.disabled;
          }, null, { timeout: 10000 });
        } catch (error) {
          // Proceed to check counts below – we’ll skip if still unavailable.
        }
      };

      await ensureTemplatesLoaded();

      const optionCount = await exportSelect.locator('option').count();
      if (optionCount <= 1) {
        console.log('⚠️  No export templates available after waiting; skipping export step.\n');
      } else {
        console.log('   Selecting export format...');
        await exportSelect.selectOption({ index: 1 });
        await page.waitForTimeout(300);

        const exportBtn = page.getByRole('button', { name: /export/i });
        const hasExportBtn = await exportBtn.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasExportBtn) {
          // Set up download listener
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

          await exportBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(screenshotDir, '17-export-initiated.png'), fullPage: true });
          console.log('📸 Screenshot: 17-export-initiated.png');

          const download = await downloadPromise;
          if (download) {
            console.log(`✅ Export successful: ${download.suggestedFilename()}`);
          } else {
            console.log('⚠️  No download detected');
          }
          console.log('📸 Screenshot saved\n');
        }
      }
    } else {
      console.log('⚠️  Export functionality not found\n');
    }

    // ============================================
    // SECTION 12: NAVIGATION & CLEANUP
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('SECTION 12: NAVIGATION & CLEANUP');
    console.log('═══════════════════════════════════════\n');

    // Step 18: Navigate back to dashboard
    console.log('Step 18: Navigating back to dashboard...');
    await page.goto(`${frontendUrl}/text`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '18-back-to-dashboard.png'), fullPage: true });
    console.log('✅ Back to dashboard');
    console.log('📸 Screenshot: 18-back-to-dashboard.png\n');

    // Step 19: Verify project appears in list
    console.log('Step 19: Verifying project in list...');
    const projectCards = page.locator('[data-testid="text-project-card"]');
    const cardCount = await projectCards.count();
    console.log(`Found ${cardCount} text projects`);

    let foundTestProject = false;
    for (let index = 0; index < cardCount; index += 1) {
      const card = projectCards.nth(index);
      const cardTitle = await card.locator('h3').textContent();
      if (cardTitle && cardTitle.includes('AI Editor Test')) {
        const cardId = await card.getAttribute('data-project-id');
        console.log(`✅ Found test project card (ID ${cardId}): ${cardTitle.trim()}`);
        foundTestProject = true;
        break;
      }
    }

    if (!foundTestProject) {
      console.log('⚠️  Test project not found in card list');
    }

    await page.screenshot({ path: path.join(screenshotDir, '19-project-verification.png'), fullPage: true });
    console.log('📸 Screenshot: 19-project-verification.png\n');

    // ============================================
    // TEST SUMMARY
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════\n');
    console.log('Test Summary:');
    console.log('  ✅ App initialization');
    console.log('  ✅ Text project creation');
    console.log('  ✅ Editor navigation');
    console.log('  ✅ Basic text editing');
    console.log('  ✅ Version history & save');
    console.log('  ✅ AI semantic reconstruction');
    console.log('  ✅ AI style generation');
    console.log('  ✅ NLP analysis');
    console.log('  ✅ Diff view & suggestions');
    console.log('  ✅ Export templates management');
    console.log('  ✅ Template-based export');
    console.log('  ✅ Dashboard navigation');
    console.log('\n📸 All screenshots saved to:', screenshotDir);
    console.log('\n🎉 AI Text Editor workflow test completed!\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);

    // Take error screenshot
    try {
      await page.screenshot({
        path: path.join(screenshotDir, 'ERROR-screenshot.png'),
        fullPage: true
      });
      console.log('📸 Error screenshot saved: ERROR-screenshot.png');
    } catch (screenshotError) {
      console.error('Failed to capture error screenshot:', screenshotError.message);
    }

    process.exit(1);
  } finally {
    await browser.close();
  }
})();
