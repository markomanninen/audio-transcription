import { test, expect } from '@playwright/test';

test.describe('Homepage Tutorial Links', () => {
  test('audio tutorial link should trigger tutorial on audio dashboard', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click "View tutorial →" link for Audio Transcription
    const audioTutorialLink = page.getByRole('link', { name: /view tutorial.*→/i }).first();
    await audioTutorialLink.click();

    // Should navigate to /audio?tutorial=true
    await expect(page).toHaveURL(/\/audio\?tutorial=true/);

    // Tutorial should be visible - look for the tutorial title text
    const tutorialTitle = page.getByText(/Welcome to Audio Transcription/i);
    await expect(tutorialTitle).toBeVisible({ timeout: 5000 });

    // Close the tutorial
    const skipButton = page.getByRole('button', { name: /skip/i });
    await skipButton.click();

    // URL should be cleaned (tutorial param removed)
    await expect(page).toHaveURL(/\/audio$/);
  });

  test('text tutorial link should trigger tutorial on text projects page', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click "View tutorial →" link for AI Text Editor
    const textTutorialLink = page.getByRole('link', { name: /view tutorial.*→/i }).last();
    await textTutorialLink.click();

    // Should navigate to /text?tutorial=true
    await expect(page).toHaveURL(/\/text\?tutorial=true/);

    // Tutorial should be visible - look for the tutorial title text
    const tutorialTitle = page.getByText(/Welcome to the AI Text Editor/i);
    await expect(tutorialTitle).toBeVisible({ timeout: 5000 });

    // Close the tutorial
    const skipButton = page.getByRole('button', { name: /skip/i });
    await skipButton.click();

    // URL should be cleaned (tutorial param removed)
    await expect(page).toHaveURL(/\/text$/);
  });

  test('both tutorial links should be present on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for both "View tutorial →" links
    const tutorialLinks = page.getByRole('link', { name: /view tutorial.*→/i });
    await expect(tutorialLinks).toHaveCount(2);

    // Verify they point to correct URLs
    const audioLink = tutorialLinks.first();
    const textLink = tutorialLinks.last();

    await expect(audioLink).toHaveAttribute('href', '/audio?tutorial=true');
    await expect(textLink).toHaveAttribute('href', '/text?tutorial=true');
  });
});
