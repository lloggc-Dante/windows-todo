import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('main window uses layered glass panels and a distinct selected task card', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-glass-material-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(1)
    const main = app.windows()[0]
    await main.getByTestId('quick-add-input').fill('选中任务')
    await main.getByTestId('quick-add-input').press('Enter')
    await main.getByTestId('quick-add-input').fill('普通任务')
    await main.getByTestId('quick-add-input').press('Enter')
    await main.locator('.task-item').filter({ hasText: '选中任务' }).click()

    for (const selector of ['.list-sidebar', '.task-panel', '.task-detail']) {
      const style = await main.locator(selector).evaluate(element => {
        const computed = getComputedStyle(element)
        return {
          radius: computed.borderRadius,
          background: computed.backgroundImage,
          edge: computed.borderTopColor,
        }
      })
      expect(style.radius).not.toBe('0px')
      expect(style.background).toContain('linear-gradient')
      expect(style.edge).toContain('rgba')
    }

    const selected = await main.locator('.task-item.selected').evaluate(element => getComputedStyle(element).backgroundImage)
    const ordinary = await main.locator('.task-item:not(.selected)').evaluate(element => getComputedStyle(element).backgroundImage)
    expect(selected).not.toBe(ordinary)
    expect(selected).toContain('linear-gradient')

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
