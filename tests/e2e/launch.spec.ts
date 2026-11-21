import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('launches a visible shell without exposing Node.js to the renderer', async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'windows-todo-e2e-'))
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: dataDirectory },
  })


  try {
    const page = await app.firstWindow()
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
    expect(await page.evaluate(() => 'require' in window)).toBe(false)
    expect(await page.evaluate(() => window.appApi.getAppVersion())).toBe('0.1.0')
  } finally {
    await app.close()
    rmSync(dataDirectory, { recursive: true, force: true })
  }
})
