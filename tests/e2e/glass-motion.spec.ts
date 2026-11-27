import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('glass buttons, task rows, and popovers animate without changing interaction', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-glass-motion-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(1)
    const main = app.windows()[0]
    const add = main.locator('.quick-add button')
    await add.hover()
    await expect.poll(() => add.evaluate(element => getComputedStyle(element).transform)).not.toBe('none')
    const box = await add.boundingBox()
    if (!box) throw new Error('添加按钮不可见')
    await main.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await main.mouse.down()
    expect(await add.evaluate(element => getComputedStyle(element).transform)).not.toBe('none')
    await main.mouse.up()

    await main.getByTestId('quick-add-input').fill('动效任务')
    const rowAnimation = main.waitForFunction(() => {
      const row = document.querySelector('.task-item')
      return row !== null && row.getAnimations().some(animation => animation.playState === 'running')
    })
    await main.getByTestId('quick-add-input').press('Enter')
    await rowAnimation
    const row = main.locator('.task-item').first()
    await expect(row).toBeVisible()

    await row.click()
    await main.getByTestId('due-date-input').fill('2026-11-24')
    await main.getByRole('button', { name: '重复规则' }).click()
    const popover = main.locator('.floating-popover')
    await expect(popover).toBeVisible()
    expect(await popover.evaluate(element => {
      const style = getComputedStyle(element)
      return style.transitionProperty.includes('opacity') && style.transitionDuration !== '0s'
    })).toBe(true)
    expect(await popover.evaluate(element => getComputedStyle(element).getPropertyValue('-webkit-app-region'))).toBe('no-drag')
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('reduced motion suppresses spatial transforms while preserving interactions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-reduced-motion-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(1)
    const main = app.windows()[0]
    await main.emulateMedia({ reducedMotion: 'reduce' })
    const add = main.locator('.quick-add button')
    await add.hover()
    expect(await add.evaluate(element => getComputedStyle(element).transform)).toBe('none')

    await main.getByTestId('quick-add-input').fill('减少动效任务')
    await main.getByTestId('quick-add-input').press('Enter')
    await expect(main.locator('[data-task-title]')).toHaveText(['减少动效任务'])
    await main.locator('.task-item').click()
    await main.getByTestId('due-date-input').fill('2026-11-24')
    await main.getByRole('button', { name: '重复规则' }).click()
    await expect(main.getByRole('listbox')).toBeVisible()
    expect(await main.locator('.floating-popover').evaluate(element => getComputedStyle(element).transform)).toBe('none')
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
