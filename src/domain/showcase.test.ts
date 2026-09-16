import { describe, expect, it } from 'vitest'
import { buildShowcase } from './showcase'
import type { AppState, Day, Goal, TaskTemplate } from './models'

const START = '2026-01-05'

function dateAt(offset: number): string {
  return new Date(Date.parse(`${START}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
}

function task(id: string, title: string): TaskTemplate {
  return {
    id, goalId: 'g1', title, frequency: 'daily', habitLevel: 0,
    habitExp: 0, targetDays: 21, cycleStartDate: START,
  }
}

function stateWith(goals: Goal[], days: Day[]): AppState {
  return {
    user: {
      id: 'u1', name: 'Т', timezone: 'UTC', notificationsEnabled: false,
      freezesRemaining: 2, freezesRefilledMonth: '2026-01', goals,
    },
    days,
  }
}

function day(date: string, extra: Partial<Day> = {}): Day {
  return {
    id: date, date, tasks: [], completionRate: 1, pathAngleDelta: 0,
    columnDriftX: 0, colorTier: 'gold', frozen: false, ...extra,
  }
}

/** `n` days, all of them done, for one task. */
function walked(taskId: string, n: number): Day[] {
  return Array.from({ length: n }, (_, i) =>
    day(dateAt(i), {
      tasks: [{ id: `d${i}`, taskTemplateId: taskId, dayId: dateAt(i), isDone: true, skipped: false, completedAt: null }],
    }),
  )
}

describe('the habits shelf', () => {
  it('gives a habit one card, however many ranks it has taken', () => {
    const days = walked('t1', 30)
    days[6].milestonesReached = [{ taskId: 't1', goalId: 'g1', rank: 'novice', days: 7 }]
    days[20].milestonesReached = [{ taskId: 't1', goalId: 'g1', rank: 'apprentice', days: 21 }]
    const shelf = buildShowcase(stateWith([{ id: 'g1', title: 'Читать', archived: false, tasks: [task('t1', 'Читать')] }], days))

    expect(shelf).toHaveLength(1)
    expect(shelf[0].rank?.id).toBe('apprentice')
    expect(shelf[0].history.map((h) => h.rank)).toEqual(['novice', 'apprentice'])
    expect(shelf[0].daysWalked).toBe(30)
  })

  it('keeps a habit that was finished on purpose, with the day it ended', () => {
    // The whole reason the ending is offered: closing a habit must not wipe it off the shelf.
    const days = walked('t1', 10)
    days[6].milestonesReached = [{ taskId: 't1', goalId: 'g1', rank: 'novice', days: 7 }]
    days[9].taskChanges = [{ taskId: 't1', goalId: 'g1', title: 'Читать', kind: 'removed' }]
    const shelf = buildShowcase(stateWith([{ id: 'g1', title: 'Цель', archived: true, tasks: [task('t1', 'Читать')] }], days))

    expect(shelf).toHaveLength(1)
    expect(shelf[0]).toMatchObject({ status: 'finished', title: 'Читать', finishedOn: dateAt(9) })
    expect(shelf[0].rank?.id).toBe('novice')
    // Its day count stopped when it stopped being asked for; the days after are not its days.
    expect(shelf[0].daysWalked).toBeNull()
  })

  it('does not double a habit that was removed from one goal and is live in another', () => {
    const days = walked('t1', 10)
    days[9].taskChanges = [{ taskId: 't1', goalId: 'g1', title: 'Читать', kind: 'removed' }]
    const shelf = buildShowcase(stateWith([{ id: 'g2', title: 'Читать', archived: false, tasks: [task('t1', 'Читать')] }], days))

    expect(shelf).toHaveLength(1)
    expect(shelf[0].status).toBe('active')
  })

  it('puts the live habits first, longest-standing at the top', () => {
    // The second habit joined on day 23, so it has 8 days against the first one's 30.
    const days = walked('t1', 30).map((d, i) => ({
      ...d,
      tasks: [
        ...d.tasks,
        ...(i >= 22 ? [{ id: `b${i}`, taskTemplateId: 't2', dayId: d.date, isDone: true, skipped: false, completedAt: null }] : []),
      ],
    }))
    const later = { ...task('t2', 'Растяжка'), cycleStartDate: dateAt(22) }
    const goal: Goal = {
      id: 'g1', title: 'Цель', archived: false, tasks: [later, task('t1', 'Читать')],
    }
    const shelf = buildShowcase(stateWith([goal], days))

    expect(shelf.map((h) => h.title)).toEqual(['Читать', 'Растяжка'])
  })

  it('drops the goal title when it only repeats the habit', () => {
    const days = walked('t1', 3)
    const shelf = buildShowcase(stateWith([{ id: 'g1', title: 'Читать', archived: false, tasks: [task('t1', 'Читать')] }], days))
    expect(shelf[0].goalTitle).toBeNull()
  })
})
