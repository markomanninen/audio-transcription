import { test, expect } from '@playwright/test';

test('debug: check what is on the page', async ({ page }) => {
  await page.goto('/audio');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  await page.screenshot({ path: 'test-results/debug-screenshot.png', fullPage: true });
  
  // Get page HTML
  const html = await page.content();
  console.log('Page HTML length:', html.length);
  
  // Check if root div has content
  const rootContent = await page.locator('#root').innerHTML();
  console.log('Root content length:', rootContent.length);
  
  // Get all buttons
  const buttons = await page.locator('button').all();
  console.log('Number of buttons found:', buttons.length);
  
  for (let i = 0; i < Math.min(buttons.length, 20); i++) {
    const text = await buttons[i].textContent();
    const isVisible = await buttons[i].isVisible();
    console.log(`Button ${i}: "${text}" (visible: ${isVisible})`);
  }
  
  // Check for any errors in console
  const messages: string[] = [];
  page.on('console', msg => messages.push(msg.text()));
  
  await page.waitForTimeout(1000);
  console.log('Console messages:', messages);
});
