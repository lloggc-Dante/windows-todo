import { _electron as electron, expect, test } from '@playwright/test'

test('launches a visible shell without exposing Node.js to the renderer', async () => {
  const app = await electron.launch({ args: ['.'] })

  try {
    const page = await app.firstWindow()
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
    expect(await page.evaluate(() => 'require' in window)).toBe(false)
    expect(await page.evaluate(() => window.appApi.getAppVersion())).toBe('0.1.0')
  } finally {
    await app.close()
  }
})
