import { _electron as electron, expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: ElectronApplication
let main: Page
let widget: Page
let dataDirectory: string

async function addWidgetTask(title: string): Promise<void> {
  await widget.getByTestId('widget-quick-add').fill(title)
  await widget.getByTestId('widget-quick-add').press('Enter')
}

test.beforeEach(async () => {
  dataDirectory = mkdtempSync(join(tmpdir(), 'windows-todo-widget-'))
  app = await electron.launch({
    args: ['.'],
    env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: dataDirectory },
  })
  await expect.poll(() => app.windows().length).toBe(2)
  main = app.windows().find(page => !page.url().includes('widget.html'))!
  widget = app.windows().find(page => page.url().includes('widget.html'))!
  await expect(main.getByTestId('app-shell')).toBeVisible()
  await expect(widget.getByTestId('desktop-widget')).toBeVisible()
  await expect.poll(() => main.evaluate(async () => (await window.appApi.listLists()).length)).toBe(1)
  await expect.poll(() => widget.evaluate(async () => (await window.appApi.listLists()).length)).toBe(1)
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDirectory, { recursive: true, force: true })
})

test('adds, completes, switches lists, and reorders with live main-window sync', async () => {
  await addWidgetTask('任务一')
  await addWidgetTask('任务二')
  await addWidgetTask('任务三')
  await expect(widget.locator('[data-widget-task-title]')).toHaveText(['任务三', '任务二', '任务一'])
  await expect(main.locator('[data-task-title]')).toHaveText(['任务三', '任务二', '任务一'])

  const completedRow = widget.locator('.widget-task-row').filter({ hasText: '任务二' })
  await completedRow.getByRole('button', { name: '完成任务' }).click()
  await expect(widget.locator('[data-widget-task-title]')).toHaveText(['任务三', '任务一'])
  await expect(main.locator('[data-task-title]')).toHaveText(['任务三', '任务一'])

  await main.getByLabel('新清单名称').fill('其他清单')
  await main.getByRole('button', { name: '添加清单' }).click()
  await expect(widget.getByTestId('widget-list-select')).toContainText('其他清单')
  await widget.getByTestId('widget-list-select').selectOption({ label: '其他清单' })
  await addWidgetTask('新清单任务')
  await expect(main.locator('[data-task-title]')).toHaveText(['新清单任务'])

  await widget.getByTestId('widget-list-select').selectOption({ label: '我的待办' })
  await addWidgetTask('任务四')
  const source = widget.locator('.widget-task-row').filter({ hasText: '任务一' })
  const target = widget.locator('.widget-task-row').filter({ hasText: '任务四' })
  await source.dragTo(target)
  await expect(widget.locator('[data-widget-task-title]')).toHaveText(['任务一', '任务四', '任务三'])
  await main.getByRole('button', { name: '我的待办', exact: true }).click()
  await expect(main.locator('[data-task-title]')).toHaveText(['任务一', '任务四', '任务三'])
})

test('keeps all nine task rows inside an eight-row scrolling viewport', async () => {
  for (let index = 1; index <= 9; index += 1) await addWidgetTask(`任务 ${index}`)

  await expect(widget.locator('.widget-task-row')).toHaveCount(9)
  const metrics = await widget.getByTestId('widget-task-list').evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(metrics.clientHeight).toBe(8 * 42)
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
  const windowHeight = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('widget.html'))
    return window?.getBounds().height
  })
  expect(windowHeight).toBeGreaterThanOrEqual(472)
  expect(windowHeight).toBeLessThanOrEqual(473)
})


test('resizes from the right edge and restores width after restart', async () => {
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find(item => item.webContents.getURL().includes('widget.html'))?.getBounds().width)).toBe(360)
  const handle = await widget.getByTestId('widget-resize-handle').boundingBox()
  if (!handle) throw new Error('贴片缩放手柄不可见')
  await widget.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await widget.mouse.down()
  await widget.mouse.move(handle.x + handle.width / 2 + 60, handle.y + handle.height / 2)
  await widget.mouse.up()
  await expect.poll(async () => {
    const width = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .find(item => item.webContents.getURL().includes('widget.html'))?.getBounds().width)
    return Math.abs((width ?? 0) - 420) <= 1
  }).toBe(true)

  await app.close()
  app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: dataDirectory } })
  await expect.poll(() => app.windows().length).toBe(2)
  main = app.windows().find(page => !page.url().includes('widget.html'))!
  widget = app.windows().find(page => page.url().includes('widget.html'))!
  const restoredWidth = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find(item => item.webContents.getURL().includes('widget.html'))?.getBounds().width)
  expect(restoredWidth).toBeGreaterThanOrEqual(419)
  expect(restoredWidth).toBeLessThanOrEqual(421)
})
