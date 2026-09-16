import { describe, expect, it } from 'vitest'
import type { AppState, Day, Goal, TaskTemplate } from './models'
import { setPrediction, tasksAddedIn } from './prediction'
import { awardMetPrediction } from './predictionAward'

const START = '2026-01-05'

function dateAt(offset: number): string {
  return new Date(Date.parse(`${START}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
}

function makeTask(over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 't1', goalId: 'g1', title: 'Читать', predictedDays: 14, cycleStartDate: START, ...over,
  }
}

/** `pattern` reads day by day: true — done, false — missed, 'rest' — not asked for. */
function makeState(pattern: (boolean | 'rest')[], task = makeTask()): AppState {
  const days: Day[] = pattern.map((entry, i) => ({
    id: dateAt(i),
    date: dateAt(i),
    tasks:
      entry === 'rest'
        ? []
        : [{ id: `dt-${i}`, taskTemplateId: task.id, dayId: dateAt(i), isDone: entry, skipped: false, completedAt: null }],
    completionRate: entry === true ? 1 : 0,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: entry === true ? 'gold' : entry === 'rest' ? 'rest' : 'red',
    frozen: false,
    rest: entry === 'rest',
  }))
  const goal: Goal = { id: 'g1', title: 'Читать', tasks: [task], archived: false }
  return {
    user: {
      id: 'u1', name: 'Тестер', timezone: 'UTC', notificationsEnabled: false,
      freezesRemaining: 2, freezesRefilledMonth: '2026-01', goals: [goal],
    },
    days,
  }
}

const lastDay = (state: AppState) => state.days[state.days.length - 1]

describe('a guess walked out', () => {
  it('says nothing while the number is still ahead', () => {
    expect(awardMetPrediction(makeState(Array(13).fill(true)))).toBeNull()
  })

  it('speaks in the words the person picked, not in a day count', () => {
    const awarded = awardMetPrediction(makeState(Array(14).fill(true)))!

    expect(awarded.award.label).toBe('Две недели')
    expect(awarded.award.predictedDays).toBe(14)
    expect(awarded.award.taskTitle).toBe('Читать')
  })

  it('stamps the day, so the moment is not replayed', () => {
    const state = awardMetPrediction(makeState(Array(14).fill(true)))!.state

    expect(lastDay(state).predictionsMet).toEqual([{ taskId: 't1', goalId: 'g1', days: 14 }])
    expect(awardMetPrediction(state)).toBeNull()
  })

  it('stays quiet after a break takes the count back under the number', () => {
    // The whole reason the stamp exists rather than a live comparison: a break pulls the day count
    // down, and the walk back up would cross the same number a second time. Being congratulated
    // twice for one guess turns a warm moment into a loop.
    const met = awardMetPrediction(makeState(Array(14).fill(true)))!.state
    const withMisses: AppState = {
      ...met,
      days: [
        ...met.days,
        ...Array(6)
          .fill(false)
          .map((_, i) => ({ ...met.days[0], id: dateAt(14 + i), date: dateAt(14 + i) })),
      ],
    }

    expect(awardMetPrediction(withMisses)).toBeNull()
  })

  it('never fires for a habit whose person skipped the question', () => {
    expect(awardMetPrediction(makeState(Array(40).fill(true), makeTask({ predictedDays: undefined })))).toBeNull()
  })

  it('counts the days the calendar counts, so a day off carries the guess too', () => {
    // Milestone days are calendar days. A habit asked for three times a week still reaches «две
    // недели» in a fortnight, and it can reach it on a Sunday nobody was asked anything.
    const pattern: (boolean | 'rest')[] = Array(14)
      .fill(null)
      .map((_, i) => (i % 2 === 0 ? true : 'rest'))

    expect(awardMetPrediction(makeState(pattern))?.award.predictedDays).toBe(14)
  })

  it('leaves an archived goal alone', () => {
    const state = makeState(Array(14).fill(true))
    state.user.goals[0].archived = true

    expect(awardMetPrediction(state)).toBeNull()
  })
})

describe('writing the guess down', () => {
  it('puts it on the habit it was asked about and leaves the others alone', () => {
    const state = makeState([true], makeTask({ predictedDays: undefined }))
    const other = makeTask({ id: 't2', title: 'Бег', predictedDays: undefined })
    state.user.goals[0].tasks.push(other)

    const next = setPrediction(state, 't1', 30)

    expect(next.user.goals[0].tasks[0].predictedDays).toBe(30)
    expect(next.user.goals[0].tasks[1].predictedDays).toBeUndefined()
  })

  it('names the habits a creation flow just made, and only those', () => {
    const before = makeState([true])
    const after: AppState = {
      ...before,
      user: {
        ...before.user,
        goals: [
          {
            ...before.user.goals[0],
            tasks: [...before.user.goals[0].tasks, makeTask({ id: 't2', title: 'Бег' })],
          },
        ],
      },
    }

    expect(tasksAddedIn(before, after)).toEqual([{ id: 't2', title: 'Бег' }])
    expect(tasksAddedIn(before, before)).toEqual([])
  })
})
