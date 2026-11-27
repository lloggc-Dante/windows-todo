import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('custom calendar and time picker preserve task scheduling fields', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'windows-todo-date-time-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WINDOWS_TODO_TEST_DATA_DIR: directory } })
  try {
    await expect.poll(() => app.windows().length).toBe(1)
    const page = app.windows().find(item => !item.url().includes('widget.html'))!
    await page.getByTestId('quick-add-input').fill('自定义日期任务')
    await page.getByTestId('quick-add-input').press('Enter')
    await page.getByTestId('due-date-input').fill('2026-11-22')
    await page.getByRole('button', { name: '打开日历' }).click()
    const calendar = page.locator('.date-popover')
    expect(await calendar.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return rect.top >= 0 && rect.bottom <= innerHeight
    })).toBe(true)
    await page.getByRole('button', { name: '23', exact: true }).click()
    await expect(page.getByTestId('due-date-input')).toHaveValue('2026-11-23')

    await page.getByLabel('指定时间').check()
    await page.getByRole('button', { name: '打开时间选择' }).click()
    await page.getByRole('button', { name: '10 时', exact: true }).click()
    await page.getByRole('button', { name: '35 分', exact: true }).click()
    await expect(page.getByLabel('截止时间')).toHaveValue('10:35')
    await page.getByRole('button', { name: '重复规则' }).click()
    await page.getByRole('option', { name: '每天', exact: true }).click()
    await page.getByRole('button', { name: '提醒时间' }).click()
    await page.getByRole('option', { name: '到期时', exact: true }).click()
    await page.getByRole('button', { name: '保存', exact: true }).click()

    const scheduled = await page.evaluate(async () => {
      const list = (await window.appApi.listLists())[0]
      return (await window.appApi.listTasks(list.id))[0]
    })
    expect(scheduled).toMatchObject({
      dueLocal: '2026-11-23T10:35',
      recurrenceRule: 'FREQ=DAILY',
      reminderOffsetMinutes: 0,
    })
    await expect(page.locator('input[type="date"], input[type="time"]')).toHaveCount(0)

    await page.getByRole('button', { name: '清除日期' }).click()
    await expect(page.getByTestId('due-date-input')).toHaveValue('')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    const cleared = await page.evaluate(async () => {
      const list = (await window.appApi.listLists())[0]
      return (await window.appApi.listTasks(list.id))[0]
    })
    expect(cleared.dueLocal).toBeNull()
    expect(cleared.recurrenceRule).toBeNull()
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
