import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('keeps backup inside advanced settings and persists notification preferences', async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'windows-todo-e2e-'))
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: dataDirectory },
  })

  try {
    const page = await app.firstWindow()
    await expect(page.getByTestId('quick-add-input')).toBeVisible()
    await expect(page.getByTestId('settings-panel')).toHaveCount(0)

    await page.getByTestId('settings-toggle').click()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await expect(page.getByTestId('advanced-backup-controls')).toBeHidden()
    await page.getByTestId('advanced-toggle').click()
    await expect(page.getByTestId('advanced-backup-controls')).toBeVisible()
    await expect(page.getByRole('button', { name: '导出备份' })).toBeVisible()
    await expect(page.getByRole('button', { name: '导入备份' })).toBeVisible()

    await page.getByLabel('启用 Windows 系统通知').uncheck()
    await page.reload()
    await page.getByTestId('settings-toggle').click()
    await expect(page.getByLabel('启用 Windows 系统通知')).not.toBeChecked()
  } finally {
    await app.close()
    rmSync(dataDirectory, { recursive: true, force: true })
  }
})
