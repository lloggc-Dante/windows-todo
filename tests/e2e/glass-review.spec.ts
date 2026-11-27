import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('leaving rows and transformed select anchors preserve geometry and hit testing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-glass-review-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(1)
    const main = app.windows()[0]
    await main.getByTestId('quick-add-input').fill('几何回归任务')
    await main.getByTestId('quick-add-input').press('Enter')
    await main.getByTestId('due-date-input').fill('2026-11-22')
    const select = main.getByRole('button', { name: '重复规则' })
    await select.click()
    await main.waitForTimeout(400)
    const widths = await main.evaluate(() => ({
      anchor: document.querySelector('.app-select')?.getBoundingClientRect().width,
      popover: document.querySelector('.app-select-popover')?.getBoundingClientRect().width,
    }))
    expect(Math.abs((widths.anchor ?? 0) - (widths.popover ?? 0))).toBeLessThanOrEqual(2)
    await select.press('Escape')

    await main.getByRole('button', { name: '完成任务' }).click()
    const leaving = main.locator('.task-list-leave-active')
    await expect(leaving).toBeVisible()
    expect(await leaving.evaluate(element => {
      const parent = element.parentElement?.getBoundingClientRect()
      const style = getComputedStyle(element)
      return Boolean(parent && element.getBoundingClientRect().width <= parent.width + 1 && style.pointerEvents === 'none')
    })).toBe(true)
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
