import { describe, expect, it } from 'vitest'
import { resolveWidgetReorder } from '../../src/shared/widget'

describe('widget reorder freshness', () => {
  it('uses the latest active task IDs instead of a stale rendered snapshot', async () => {
    const latest = [
      { id: 'dragged', completedAt: null },
      { id: 'new-from-other-window', completedAt: null },
      { id: 'target', completedAt: null },
      { id: 'completed', completedAt: new Date().toISOString() },
    ]

    const ids = await resolveWidgetReorder('dragged', 'target', async () => latest)

    expect(ids).toEqual(['new-from-other-window', 'dragged', 'target'])
  })
})
