import { describe, expect, it } from 'vitest'
import { autoApplyFreezesToGaps } from './freezes'
import type { AppState, Day } from './models'

function makeDay(date: string, rest: boolean): Day {
  return {
    id: date,
    date,
    tasks: [],
    completionRate: 0,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: rest ? 'rest' : 'gray',
    frozen: false,
    rest,
  }
}

function makeState(days: Day[], freezesRemaining: number): AppState {
  return {
    user: {
      id: 'u',
      name: 'Т',
      timezone: 'UTC',
      notificationsEnabled: false,
      freezesRemaining,
      freezesRefilledMonth: '2026-01',
      goals: [],
    },
    days,
  }
}

describe('autoApplyFreezesToGaps', () => {
  it('spends a credit on a rebuilt day that owed something', () => {
    const state = makeState([makeDay('2026-01-02', false)], 2)
    const next = autoApplyFreezesToGaps(state, new Set(['2026-01-02']))
    expect(next.days[0].frozen).toBe(true)
    expect(next.user.freezesRemaining).toBe(1)
  })

  it('skips a rest day: it already owes nothing, and paying for it would charge the person for a day off', () => {
    const state = makeState([makeDay('2026-01-03', true), makeDay('2026-01-04', true)], 2)
    const next = autoApplyFreezesToGaps(state, new Set(['2026-01-03', '2026-01-04']))
    expect(next.days.every((d) => d.frozen === false)).toBe(true)
    expect(next.user.freezesRemaining).toBe(2)
  })

  it('saves the credits for the days inside an absence that actually needed them', () => {
    // A week away over a Пн Ср Пт habit: the two weekend days must not eat the month's allowance
    // before the weekdays that did go missing.
    const state = makeState(
      [makeDay('2026-01-03', true), makeDay('2026-01-04', true), makeDay('2026-01-05', false)],
      2,
    )
    const next = autoApplyFreezesToGaps(state, new Set(['2026-01-03', '2026-01-04', '2026-01-05']))
    expect(next.days.map((d) => d.frozen)).toEqual([false, false, true])
    expect(next.user.freezesRemaining).toBe(1)
  })
})
