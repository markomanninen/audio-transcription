import { test } from '@playwright/test';

test('check console errors', async ({ page }) => {
  const consoleMessages: any[] = [];
  const errors: any[] = [];
  
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error);
    console.log('PAGE ERROR:', error.message);
  });
  
  await page.goto('/audio');
  await page.waitForTimeout(5000);
  
  console.log('\n=== Console Messages ===');
  consoleMessages.forEach((msg, i) => {
    console.log(`${i}. [${msg.type}] ${msg.text}`);
  });
  
  console.log('\n=== Page Errors ===');
  errors.forEach((err, i) => {
    console.log(`${i}. ${err.message}`);
    console.log(`   ${err.stack}`);
  });
});
