import { _electron as electron, expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: ElectronApplication
let main: Page
let widget: Page
let dataDirectory: string
const directories: string[] = []

function tempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-widget-settings-'))
  directories.push(directory)
  return directory
}

async function launch(): Promise<void> {
  app = await electron.launch({
    args: ['.'],
    env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: dataDirectory },
  })
  await expect.poll(() => app.windows().length).toBe(2)
  main = app.windows().find(page => !page.url().includes('widget.html'))!
  widget = app.windows().find(page => page.url().includes('widget.html'))!
  await expect(main.getByTestId('app-shell')).toBeVisible()
}

test.beforeEach(() => {
  dataDirectory = tempDirectory()
})

test.afterEach(async () => {
  if (app) {
    await app.evaluate(({ app: electronApp }) => electronApp.setLoginItemSettings({ openAtLogin: false })).catch(() => undefined)
    await app.close()
  }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

test('show widget setting hides, reopens, and survives restart', async () => {
  await launch()
  await main.getByTestId('settings-toggle').click()
  const checkbox = main.getByLabel('显示桌面贴片')
  await expect(checkbox).toBeChecked()
  await checkbox.uncheck()
  await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('widget.html'))?.isVisible())).toBe(false)
  await checkbox.check()
  await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('widget.html'))?.isVisible())).toBe(true)

  await checkbox.uncheck()
  await app.close()
  await launch()
  await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('widget.html'))?.isVisible())).toBe(false)
  await main.getByTestId('settings-toggle').click()
  await expect(main.getByLabel('显示桌面贴片')).not.toBeChecked()
})

test('widget buttons open the main window and hide the widget', async () => {
  await launch()
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().find(item => !item.webContents.getURL().includes('widget.html'))?.hide()
  })
  await widget.getByTitle('打开主窗口').click()
  await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find(item => !item.webContents.getURL().includes('widget.html'))?.isFocused())).toBe(true)

  await widget.getByTitle('隐藏贴片').click()
  await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('widget.html'))?.isVisible())).toBe(false)
  await expect.poll(() => main.evaluate(async () => (await window.appApi.getSettings()).showWidget)).toBe(false)
})

test('unrelated settings keep main-window focus and do not revive a hidden widget', async () => {
  await launch()
  await main.getByTestId('settings-toggle').click()
  await main.getByLabel('启用 Windows 系统通知').uncheck()
  await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find(item => !item.webContents.getURL().includes('widget.html'))?.isFocused())).toBe(true)

  await main.getByRole('button', { name: '关闭设置' }).click()
  await widget.getByTitle('隐藏贴片').click()
  await main.getByTestId('settings-toggle').click()
  await main.getByLabel('登录 Windows 后自动启动').check()
  await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('widget.html'))?.isVisible())).toBe(false)
  await main.getByLabel('登录 Windows 后自动启动').uncheck()
})

test('backup replacement reapplies widget visibility, position, and selected list', async () => {
  const sourceDirectory = tempDirectory()
  const now = new Date().toISOString()
  const list = { id: randomUUID(), name: '备份清单', createdAt: now, updatedAt: now }
  const backup = {
    format: 'windows-todo-backup',
    schemaVersion: 1,
    exportedAt: now,
    data: {
      lists: [list],
      tasks: [{
        id: randomUUID(), listId: list.id, title: '备份任务', notes: null,
        dueLocal: null, dueHasTime: false, recurrenceRule: null, seriesStart: null,
        reminderOffsetMinutes: null, sortOrder: 0, completedAt: null,
        createdAt: now, updatedAt: now,
      }],
      completions: [],
      settings: {
        widgetVisible: 'false',
        widgetSelectedList: list.id,
        widgetPosition: JSON.stringify({ displayId: 1, x: 123, y: 234, width: 520, height: 178 }),
      },
    },
  }
  const filename = join(sourceDirectory, 'backup.json')
  writeFileSync(filename, JSON.stringify(backup))

  await launch()
  await app.evaluate(({ dialog }, backupPath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [backupPath], bookmarks: [] })
  }, filename)
  await main.getByTestId('settings-toggle').click()
  await main.getByTestId('advanced-toggle').click()
  await main.getByRole('button', { name: '导入备份' }).click()
  main.once('dialog', dialog => dialog.accept())
  await main.getByRole('button', { name: '确认替换全部数据' }).click()
  await expect(main.getByRole('status')).toContainText('导入完成')
  await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('widget.html'))?.isVisible())).toBe(false)

  await main.getByLabel('显示桌面贴片').check()
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('widget.html'))
    return window?.getBounds().x
  })).toBe(123)
  await expect(widget.getByTestId('widget-list-select')).toHaveValue(list.id)
})
