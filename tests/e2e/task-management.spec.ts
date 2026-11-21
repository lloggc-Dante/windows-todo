import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('manages title-only tasks, manual order, and collapsed completion history', async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'windows-todo-e2e-'))
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: dataDirectory },
  })

  try {
    const page = await app.firstWindow()
    const quickAdd = page.getByTestId('quick-add-input')
    await expect(quickAdd).toBeVisible()

    await quickAdd.fill('以后整理书桌')
    await quickAdd.press('Enter')
    await quickAdd.fill('第二项')
    await quickAdd.press('Enter')

    const titles = page.locator('[data-testid="active-task-list"] [data-task-title]')
    await expect(titles).toHaveText(['第二项', '以后整理书桌'])
    await page.locator('[data-testid="active-task-list"] .task-item').filter({ hasText: '以后整理书桌' }).click()
    await expect(page.getByTestId('task-title-input')).toHaveValue('以后整理书桌')
    await expect(page.getByTestId('due-date-input')).toHaveValue('')

    await expect(page.locator('[data-testid="search-input"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="smart-filters"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="tags-input"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="priority-input"]')).toHaveCount(0)

    const firstTask = page.locator('[data-testid="active-task-list"] .task-item').nth(1)
    const secondTask = page.locator('[data-testid="active-task-list"] .task-item').nth(0)
    await firstTask.dragTo(secondTask)
    await expect(titles).toHaveText(['以后整理书桌', '第二项'])

    await page.reload()
    await expect(page.locator('[data-testid="active-task-list"] [data-task-title]'))
      .toHaveText(['以后整理书桌', '第二项'])

    const completedSource = page.locator('[data-testid="active-task-list"] .task-item')
      .filter({ hasText: '以后整理书桌' })
    await completedSource.getByRole('button', { name: '完成任务' }).click()
    await expect(page.getByTestId('completed-toggle')).toContainText('1')
    await expect(page.getByTestId('completed-task-list')).toBeHidden()
    await expect(page.locator('[data-testid="active-task-list"] [data-task-title]')).toHaveText(['第二项'])

    await page.getByTestId('completed-toggle').click()
    await expect(page.getByTestId('completed-task-list')).toBeVisible()
    await expect(page.getByTestId('completed-task-list')).toContainText('以后整理书桌')
  } finally {
    await app.close()
    rmSync(dataDirectory, { recursive: true, force: true })
  }
})
