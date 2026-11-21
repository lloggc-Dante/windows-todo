import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('custom titlebar controls and double-click preserve window lifecycle', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-chrome-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  let didExit = false
  try {
    await expect.poll(() => app.windows().length).toBe(2)
    const page = app.windows().find(item => !item.url().includes('widget.html'))!
    const widget = app.windows().find(item => item.url().includes('widget.html'))!
    await expect(page.getByTestId('window-titlebar')).toBeVisible()

    await page.getByRole('button', { name: '最小化' }).click()
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .find(item => !item.webContents.getURL().includes('widget.html'))?.isMinimized())).toBe(true)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .find(item => !item.webContents.getURL().includes('widget.html'))?.restore())

    await page.getByRole('button', { name: '最大化或还原' }).click()
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .find(item => !item.webContents.getURL().includes('widget.html'))?.isMaximized())).toBe(true)
    await page.getByRole('button', { name: '最大化或还原' }).click()
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .find(item => !item.webContents.getURL().includes('widget.html'))?.isMaximized())).toBe(false)

    await page.getByTestId('window-titlebar-drag').dblclick()
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .find(item => !item.webContents.getURL().includes('widget.html'))?.isMaximized())).toBe(true)
    await page.getByRole('button', { name: '最大化或还原' }).click()

    await page.getByRole('button', { name: '关闭窗口' }).click()
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
      .find(item => !item.webContents.getURL().includes('widget.html'))?.isVisible())).toBe(false)
    expect(app.process().exitCode).toBeNull()
    await widget.getByTitle('打开主窗口').click()

    await page.evaluate(() => window.appApi.updateSettings({ closeToTray: false }))
    const exited = new Promise<number | null>(resolve => app.process().once('exit', code => resolve(code)))
    await page.getByRole('button', { name: '关闭窗口' }).click()
    const exitCode = await exited
    didExit = true
    expect(exitCode).toBe(0)
  } finally {
    if (!didExit) await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
