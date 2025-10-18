import { test, expect } from '@playwright/test'

const API_BASE_URL = process.env.LOCAL_API_URL || 'http://127.0.0.1:8000'

test.describe('Application Health', () => {
  test('frontend loads successfully', async ({ page }) => {
    await page.goto('/audio')
    await expect(page.getByRole('heading', { name: /audio transcription studio/i }).first()).toBeVisible()
  })

  test('backend API is accessible', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`)
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.status).toBe('healthy')
  })
})
