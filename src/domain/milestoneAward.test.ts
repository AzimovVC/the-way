import { describe, expect, it } from 'vitest'
import { awardReachedMilestone } from './milestoneAward'
import type { AppState, Day, Goal, TaskTemplate } from './models'

const START = '2026-01-05'

function dateAt(offset: number): string {
  return new Date(Date.parse(`${START}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
}

function makeTask(over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 't1', goalId: 'g1', title: 'Читать', frequency: 'daily', habitLevel: 0,
    habitExp: 0, targetDays: 21, cycleStartDate: START, ...over,
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

describe('crossing something', () => {
  it('gives nothing while both the first rung and the target are ahead', () => {
    expect(awardReachedMilestone(makeState([true, true]))).toBeNull()
  })

  it('takes the rank on a day the task was never asked for', () => {
    // The whole reason this does not live on the mark: milestone days are calendar days, so a
    // threshold can fall on a rest day, and the card used to sit past it waiting for a tap the
    // schedule was not going to ask for.
    const awarded = awardReachedMilestone(makeState([...Array(6).fill(true), 'rest']))

    expect(awarded?.award.kind).toBe('rank')
    expect(awarded?.award.rank?.id).toBe('novice')
    expect(lastDay(awarded!.state).milestonesReached).toEqual([
      { taskId: 't1', goalId: 'g1', rank: 'novice', days: 7 },
    ])
  })

  it('asks the question at the target and stamps the rank that lands with it', () => {
    // 21 days is both this habit's target and the «Ученик» rung. One screen, not two: the target
    // is the one that asks something, so it is the one that shows.
    const awarded = awardReachedMilestone(makeState(Array(21).fill(true), makeTask({ id: 't1' })))!

    expect(awarded.award.kind).toBe('target')
    expect(awarded.award.rank?.id).toBe('apprentice')
    expect(lastDay(awarded.state).targetsReached).toEqual([{ taskId: 't1', goalId: 'g1', days: 21 }])
    expect(lastDay(awarded.state).milestonesReached).toHaveLength(1)
  })

  it('asks about the target once, even after the days dip back under it', () => {
    const state = awardReachedMilestone(makeState(Array(21).fill(true)))!.state
    // Every later call sees the stamp and leaves the question alone.
    const again = awardReachedMilestone(state)
    expect(again?.award.kind).not.toBe('target')
  })

  it('hands out one rank per call and stops when the days run out', () => {
    let state = makeState(Array(30).fill(true))
    const seen: string[] = []
    for (let i = 0; i < 6; i += 1) {
      const awarded = awardReachedMilestone(state)
      if (!awarded) break
      seen.push(`${awarded.award.kind}:${awarded.award.rank?.id}`)
      state = awarded.state
    }

    // One screen, not two: the target fired and stamped «Ученик» with it, and «Практик» is still
    // 36 days away — so there is nothing left to hand out.
    expect(seen).toEqual(['target:apprentice'])
    expect(awardReachedMilestone(state)).toBeNull()
  })

  it('never re-celebrates a rank the days fell back under', () => {
    const walked = awardReachedMilestone(makeState([...Array(7).fill(true)]))!.state
    const slipped: AppState = {
      ...walked,
      days: [...walked.days, { ...walked.days[0], id: 'x', date: dateAt(7), tasks: [{ id: 'dt-x', taskTemplateId: 't1', dayId: dateAt(7), isDone: false, skipped: false, completedAt: null }], rest: false }],
    }

    expect(awardReachedMilestone(slipped)).toBeNull()
  })

  it('skips an archived goal', () => {
    const state = makeState(Array(21).fill(true))
    state.user.goals[0].archived = true

    expect(awardReachedMilestone(state)).toBeNull()
  })
})
