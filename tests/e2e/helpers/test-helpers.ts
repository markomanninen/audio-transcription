import { Page, expect } from '@playwright/test';

export async function skipTutorialIfPresent(page: Page) {
  await page.evaluate(() => {
    window.localStorage.setItem('hasSeenTutorial', 'true');
    window.localStorage.setItem('hasSeenAudioTutorial', 'true');
  });

  const splash = page.getByTestId('loading-splash');
  await splash.waitFor({ state: 'detached', timeout: 30000 });

  const skipButton = page.getByRole('button', { name: /skip/i });
  if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipButton.click();
  }
}

export async function waitForProjectReady(page: Page, projectName?: string) {
  if (projectName) {
    await page.waitForFunction(
      (projectName) => {
        const select = document.querySelector('select') as HTMLSelectElement;
        if (!select) return false;
        
        const options = Array.from(select.options);
        return options.some(option => option.text.includes(projectName));
      },
      projectName,
      { timeout: 15000 }
    );
  } else {
    // Wait for any project to be selected
    await page.waitForFunction(
      () => {
        const select = document.querySelector('select') as HTMLSelectElement;
        return select && /^\d+$/.test(select.value);
      },
      { timeout: 15000 }
    );
  }
}

export async function changeAIModel(page: Page, model: string) {
  // Store the model in localStorage
  await page.evaluate((model) => {
    localStorage.setItem('ollama_model', model);
    localStorage.setItem('llmProvider', 'ollama');
  }, model);

  // Navigate to settings if available
  const settingsButton = page.getByRole('button', { name: /settings/i });
  if (await settingsButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await settingsButton.click();
    
    const modelSelect = page.getByLabel(/model/i);
    if (await modelSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await modelSelect.selectOption(model);
    }
  }
}

export async function getLLMLogs(page: Page, options?: { limit?: number; operation?: string }) {
  const config = getEnvironmentConfig();
  const baseUrl = config.urls.backend;
  
  let url = `${baseUrl}/api/llm-logs`;
  const params = new URLSearchParams();
  
  if (options?.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options?.operation) {
    params.append('operation', options.operation);
  }
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  const response = await fetch(url);
  return await response.json();
}

export async function makeApiRequest(url: string, options?: RequestInit) {
  return await fetch(url, options);
}

export function getEnvironmentConfig() {
  // Detect environment based on available variables and current URL
  const isE2E = process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST_BASE_URL || typeof window === 'undefined';
  const isDocker = process.env.DOCKER_ENV === '1';
  const isProduction = process.env.NODE_ENV === 'production';
  
  let environment = 'local';
  let frontendUrl = 'http://localhost:3000';
  let backendUrl = 'http://localhost:8000';
  
  if (isE2E) {
    environment = 'e2e';
    // E2E tests use dynamic ports - detect from current context or use defaults
    if (typeof window !== 'undefined') {
      // Browser context - extract port from current URL
      const currentPort = window.location.port;
      frontendUrl = `${window.location.protocol}//${window.location.hostname}:${currentPort}`;
      // Backend is typically frontend port - 1000 + 220 offset
      const backendPort = parseInt(currentPort) - 1000 + 220;
      backendUrl = `http://127.0.0.1:${backendPort}`;
    } else {
      // Node context - use Playwright environment variables or defaults
      frontendUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:18356';
      backendUrl = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:18220';
    }
  } else if (isDocker) {
    environment = 'docker';
    frontendUrl = 'http://localhost:3000';
    backendUrl = 'http://localhost:8000';
  } else if (isProduction) {
    environment = 'production';
    frontendUrl = process.env.FRONTEND_URL || 'https://your-app.com';
    backendUrl = process.env.BACKEND_URL || 'https://api.your-app.com';
  }
  
  return {
    environment,
    urls: {
      frontend: frontendUrl,
      backend: backendUrl
    }
  };
}

export function getTimeouts() {
  const config = getEnvironmentConfig();
  
  // Adjust timeouts based on environment
  const baseTimeouts = {
    default: 10000,
    navigation: 30000,
    element: 10000,
    api: 15000,
    transcription: 60000,
    aiCorrection: 20000,
    long: 45000
  };
  
  if (config.environment === 'docker' || config.environment === 'production') {
    // Increase timeouts for slower environments
    return {
      default: baseTimeouts.default * 2,
      navigation: baseTimeouts.navigation * 1.5,
      element: baseTimeouts.element * 1.5,
      api: baseTimeouts.api * 2,
      transcription: baseTimeouts.transcription * 2,
      aiCorrection: baseTimeouts.aiCorrection * 2,
      long: baseTimeouts.long * 2
    };
  }
  
  return baseTimeouts;
}
