import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('custom selects support pointer, keyboard, escape, and outside dismissal', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-custom-controls-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(2)
    const main = app.windows().find(page => !page.url().includes('widget.html'))!
    const widget = app.windows().find(page => page.url().includes('widget.html'))!
    await main.getByTestId('quick-add-input').fill('自定义控件任务')
    await main.getByTestId('quick-add-input').press('Enter')

    await main.getByTestId('due-date-input').fill('2026-11-22')
    const recurrence = main.getByRole('button', { name: '重复规则' })
    await recurrence.click()
    await expect(main.getByRole('listbox')).toBeVisible()
    await main.getByRole('option', { name: '每周', exact: true }).click()
    await expect(recurrence).toContainText('每周')

    await recurrence.focus()
    await recurrence.press('ArrowDown')
    await expect(main.getByRole('listbox')).toBeVisible()
    await recurrence.press('ArrowDown')
    await recurrence.press('Enter')
    await expect(recurrence).toContainText('每月')

    await recurrence.click()
    await recurrence.press('Escape')
    await expect(main.getByRole('listbox')).toHaveCount(0)
    await expect(recurrence).toContainText('每月')
    await recurrence.click()
    await main.getByTestId('task-title-input').click()
    await expect(main.getByRole('listbox')).toHaveCount(0)

    await expect(main.locator('select')).toHaveCount(0)
    await expect(widget.locator('select')).toHaveCount(0)
    await widget.getByTestId('widget-list-select').click()
    await expect(widget.getByRole('option', { name: '我的待办', exact: true })).toBeVisible()
    await widget.getByTestId('widget-list-select').press('Escape')

    await main.getByTestId('settings-toggle').click()
    const toggle = main.getByLabel('显示桌面贴片')
    await expect(toggle).toHaveCSS('appearance', 'none')
    await toggle.uncheck()
    await expect(toggle).not.toBeChecked()
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
