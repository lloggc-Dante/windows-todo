import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('shared Apple glass tokens and balanced translucent layers apply to both windows', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-glass-material-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(2)
    const main = app.windows().find(page => !page.url().includes('widget.html'))!
    const widget = app.windows().find(page => page.url().includes('widget.html'))!
    await expect(widget.getByTestId('desktop-widget')).toBeVisible()

    const shell = await widget.getByTestId('desktop-widget').evaluate(element => {
      const style = getComputedStyle(element)
      return {
        backdrop: style.backdropFilter,
        background: style.backgroundImage,
        edge: style.getPropertyValue('--glass-edge').trim(),
        highlight: getComputedStyle(element, '::after').backgroundImage,
      }
    })
    expect(shell.backdrop).toContain('blur(30px)')
    expect(shell.backdrop).toMatch(/saturate\((180%|1\.8)\)/)
    expect(shell.background).toContain('radial-gradient')
    expect(shell.edge).not.toBe('')
    expect(shell.highlight).not.toBe('none')

    const titlebar = await main.getByTestId('window-titlebar').evaluate(element =>
      getComputedStyle(element).backdropFilter)
    expect(titlebar).toMatch(/saturate\((180%|1\.8)\)/)
    expect(await main.evaluate(() => getComputedStyle(document.documentElement)
      .getPropertyValue('--glass-surface').trim())).not.toBe('')
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
