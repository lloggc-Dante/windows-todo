import { _electron as electron, expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: ElectronApplication
let page: Page
let dataDirectory: string

test.beforeEach(async () => {
  dataDirectory = mkdtempSync(join(tmpdir(), 'windows-todo-review-'))
  app = await electron.launch({
    args: ['.'],
    env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: dataDirectory },
  })
  await expect.poll(() => app.windows().length).toBe(1)
  page = app.windows().find(candidate => !candidate.url().includes('widget.html'))!
  await expect(page.getByTestId('quick-add-input')).toBeVisible()
  await page.getByTestId('quick-add-input').fill('重复任务')
  await page.getByTestId('quick-add-input').press('Enter')
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDirectory, { recursive: true, force: true })
})

test('preserves COUNT when editing an unrelated task field', async () => {
  await page.getByTestId('due-date-input').fill('2026-11-22')
  await page.getByRole('button', { name: '重复规则' }).click()
  await page.getByRole('option', { name: '每天', exact: true }).click()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.evaluate(async () => {
    const list = (await window.appApi.listLists())[0]
    const task = (await window.appApi.listTasks(list.id))[0]
    await window.appApi.updateTask(task.id, { recurrenceRule: 'FREQ=DAILY;COUNT=3' })
  })
  await page.reload()
  await page.locator('[data-task-title]').click()
  await page.getByTestId('task-title-input').fill('只修改标题')
  await page.getByRole('button', { name: '保存', exact: true }).click()

  const rule = await page.evaluate(async () => {
    const list = (await window.appApi.listLists())[0]
    return (await window.appApi.listTasks(list.id))[0].recurrenceRule
  })
  expect(rule).toBe('FREQ=DAILY;COUNT=3')
})

test('shows recurring completion history and undo in the task detail', async () => {
  await page.getByTestId('due-date-input').fill('2026-11-22')
  await page.getByRole('button', { name: '重复规则' }).click()
  await page.getByRole('option', { name: '每天', exact: true }).click()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('button', { name: '完成任务' }).click()

  await expect(page.getByTestId('completion-history')).toBeVisible()
  await expect(page.getByTestId('completion-history')).toContainText('2026-11-22')
  await page.getByRole('button', { name: '撤销最近完成' }).click()
  await expect(page.getByTestId('completion-history')).toContainText('暂无完成记录')
  await expect(page.getByTestId('due-date-input')).toHaveValue('2026-11-22')
})

test('keeps task editing available at the minimum window width', async () => {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find(item => !item.webContents.getURL().includes('widget.html'))?.setSize(760, 700))
  await page.locator('[data-task-title]').click()
  await expect(page.getByTestId('task-title-input')).toBeVisible()
})

test('shows validation errors from task actions', async () => {
  await page.getByTestId('task-title-input').fill('   ')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('任务标题不能为空')
})
