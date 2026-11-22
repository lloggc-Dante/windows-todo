import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('glass buttons, task rows, and popovers animate without changing drag regions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-glass-motion-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(2)
    const main = app.windows().find(page => !page.url().includes('widget.html'))!
    const widget = app.windows().find(page => page.url().includes('widget.html'))!
    const add = widget.getByRole('button', { name: '贴片添加' })
    await add.hover()
    await expect.poll(() => add.evaluate(element => getComputedStyle(element).transform)).not.toBe('none')
    const box = await add.boundingBox()
    if (!box) throw new Error('添加按钮不可见')
    await widget.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await widget.mouse.down()
    const pressed = await add.evaluate(element => getComputedStyle(element).transform)
    expect(pressed).not.toBe('none')
    await widget.mouse.up()

    await main.getByTestId('quick-add-input').fill('动效任务')
    await main.getByTestId('quick-add-input').press('Enter')
    const row = main.locator('.task-item').first()
    await expect(row).toBeVisible()
    expect(await row.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0)

    await widget.getByTestId('widget-list-select').click()
    const popover = widget.locator('.floating-popover')
    await expect(popover).toBeVisible()
    expect(await popover.evaluate(element => {
      const style = getComputedStyle(element)
      return style.transitionProperty.includes('opacity') && style.transitionDuration !== '0s'
    })).toBe(true)
    expect(await popover.evaluate(element => getComputedStyle(element).getPropertyValue('-webkit-app-region'))).toBe('no-drag')
    expect(await widget.locator('.widget-header').evaluate(element => getComputedStyle(element).getPropertyValue('-webkit-app-region'))).toBe('drag')
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})


test('reduced motion suppresses spatial transforms while preserving interactions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-reduced-motion-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(2)
    const main = app.windows().find(page => !page.url().includes('widget.html'))!
    const widget = app.windows().find(page => page.url().includes('widget.html'))!
    await main.emulateMedia({ reducedMotion: 'reduce' })
    await widget.emulateMedia({ reducedMotion: 'reduce' })
    const add = widget.getByRole('button', { name: '贴片添加' })
    await add.hover()
    expect(await add.evaluate(element => getComputedStyle(element).transform)).toBe('none')

    await main.getByTestId('quick-add-input').fill('减少动效任务')
    await main.getByTestId('quick-add-input').press('Enter')
    await expect(main.locator('[data-task-title]')).toHaveText(['减少动效任务'])
    await widget.getByTestId('widget-list-select').click()
    await expect(widget.getByRole('listbox')).toBeVisible()
    expect(await widget.locator('.floating-popover').evaluate(element => getComputedStyle(element).transform)).toBe('none')
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
