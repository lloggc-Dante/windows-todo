import { _electron as electron, chromium, expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('custom titlebar controls and double-click preserve window lifecycle', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-chrome-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(1)
    const page = app.windows()[0]
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
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show())
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())).toBe(true)
  } finally {
    await app.close().catch(() => undefined)
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})


test('closeToTray=false exits the whole application with code zero', async () => {
  test.setTimeout(60_000)
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-quit-'))
  const port = 9600 + Math.floor(Math.random() * 300)
  const child = spawn(join(process.cwd(), 'node_modules/electron/dist/electron.exe'), [
    '.', `--remote-debugging-port=${port}`,
  ], { env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory }, stdio: 'ignore' })
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined
  try {
    await expect.poll(async () => {
      try { return (await fetch(`http://127.0.0.1:${port}/json/list`)).ok } catch { return false }
    }).toBe(true)
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    const context = browser.contexts()[0]
    await expect.poll(() => context.pages().length).toBe(1)
    const page = context.pages().find(item => !item.url().includes('widget.html'))!
    await page.evaluate(() => window.appApi.updateSettings({ closeToTray: false }))
    const exited = new Promise<number | null>(resolve => child.once('exit', code => resolve(code)))
    try {
      await page.evaluate(() => window.appApi.closeWindow())
    } catch (error) {
      if (!/closed|Target/i.test(String(error))) throw error
    }
    expect(await exited).toBe(0)
  } finally {
    await browser?.close().catch(() => undefined)
    if (child.exitCode === null) child.kill()
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})
