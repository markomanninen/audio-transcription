import { test, expect } from '@playwright/test'

test.describe('Application Health', () => {
  test('frontend loads successfully', async ({ page }) => {
    await page.goto('/')
    // Use a more specific selector to avoid strict mode violation
    await expect(page.getByRole('heading', { name: 'Audio Transcription', exact: true }).first()).toBeVisible()
  })

  test('backend API is accessible', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health')
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.status).toBe('healthy')
  })
})
