import { describe, expect, it } from 'vitest'
import { computeProfileOverview } from './profile'
import type { AppState, Day } from './models'

function day(date: string, extra: Partial<Day> = {}): Day {
  return {
    id: date,
    date,
    tasks: [],
    completionRate: 1,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: 'gold',
    frozen: false,
    ...extra,
  }
}

function stateWith(days: Day[], goals: AppState['user']['goals'] = []): AppState {
  return {
    user: {
      id: 'u',
      name: '',
      timezone: 'UTC',
      notificationsEnabled: false,
      freezesRemaining: 2,
      freezesRefilledMonth: '2026-03',
      goals,
    },
    days,
  }
}

describe('computeProfileOverview', () => {
  it('reads the start of the road from the earliest day, not the array order', () => {
    const overview = computeProfileOverview(stateWith([day('2026-03-10'), day('2026-03-04')]))
    expect(overview.startDate).toBe('2026-03-04')
    expect(overview.totalDays).toBe(2)
  })

  it('has no start date before the road has a first day', () => {
    expect(computeProfileOverview(stateWith([])).startDate).toBeNull()
  })

  it('counts gold days and the current streak the way the path screen does', () => {
    const overview = computeProfileOverview(
      stateWith([day('2026-03-01', { colorTier: 'red' }), day('2026-03-02'), day('2026-03-03')]),
    )
    expect(overview.totalGoldDays).toBe(2)
    expect(overview.currentGoldStreak).toBe(2)
  })
})
