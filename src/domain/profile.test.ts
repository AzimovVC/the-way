import { describe, expect, it } from 'vitest'
import { collectTrophies, computeProfileOverview } from './profile'
import type { AppState, Day } from './models'
import type { RankId } from './ranks'

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

describe('collectTrophies', () => {
  const milestone = (taskId: string, rank: RankId, days: number) => ({ taskId, goalId: 'g1', rank, days })

  it('reads the shelf out of the days, newest first', () => {
    const trophies = collectTrophies(
      stateWith([
        day('2026-03-01', { milestonesReached: [milestone('t1', 'apprentice', 21)] }),
        day('2026-04-01', { milestonesReached: [milestone('t1', 'practitioner', 66)] }),
      ]),
    )
    expect(trophies.map((t) => t.rank)).toEqual(['practitioner', 'apprentice'])
    expect(trophies[0].date).toBe('2026-04-01')
  })

  it('keeps a trophy whose task was later removed, with no name to show', () => {
    const trophies = collectTrophies(
      stateWith([day('2026-03-01', { milestonesReached: [milestone('gone', 'apprentice', 21)] })]),
    )
    expect(trophies).toHaveLength(1)
    expect(trophies[0].taskTitle).toBeNull()
  })

  it('names the task and goal while they still exist', () => {
    const goals = [
      {
        id: 'g1',
        title: 'Бегать',
        archived: false,
        tasks: [
          {
            id: 't1',
            goalId: 'g1',
            title: 'Пробежка',
            frequency: 'daily' as const,
            habitLevel: 0,
            habitExp: 0,
            targetDays: 66,
            cycleStartDate: '2026-03-01',
          },
        ],
      },
    ]
    const trophies = collectTrophies(
      stateWith([day('2026-03-01', { milestonesReached: [milestone('t1', 'apprentice', 21)] })], goals),
    )
    expect(trophies[0].taskTitle).toBe('Пробежка')
    expect(trophies[0].goalTitle).toBe('Бегать')
  })
})
