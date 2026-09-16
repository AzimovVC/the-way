import { describe, expect, it } from 'vitest'
import { awardReachedTier } from './milestoneAward'
import type { AppState, Day, Goal, TaskTemplate } from './models'

const START = '2026-01-05'

function dateAt(offset: number): string {
  return new Date(Date.parse(`${START}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
}

function makeTask(over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 't1', goalId: 'g1', title: 'Читать', frequency: 'daily', habitLevel: 0,
    habitExp: 0, targetDays: 3, currentTier: 'none', cycleStartDate: START, ...over,
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

const taskOf = (state: AppState) => state.user.goals[0].tasks[0]

describe('taking a rank', () => {
  it('gives nothing while the days are short', () => {
    expect(awardReachedTier(makeState([true, true]))).toBeNull()
  })

  it('takes the rank on a day the task was never asked for', () => {
    // The whole reason this does not live on the mark: milestone days are calendar days, so the
    // target can fall on a rest day, and the card used to sit past its target waiting for a tap
    // the schedule was not going to ask for.
    const awarded = awardReachedTier(makeState([true, true, 'rest']))

    expect(awarded?.award.tier).toBe('bronze')
    expect(taskOf(awarded!.state).currentTier).toBe('bronze')
  })

  it('leaves the cycle start alone, so the surplus days count toward the next rank', () => {
    const awarded = awardReachedTier(makeState([true, true, true, true, true]))!

    expect(taskOf(awarded.state).cycleStartDate).toBe(START)
    expect(awarded.award.report.daysWalked).toBe(5)
    expect(awarded.award.report.targetDays).toBe(3)
    expect(awarded.award.report.nextTierTarget).toBe(6)
  })

  it('stamps the rank on the day the road is standing on', () => {
    const awarded = awardReachedTier(makeState([true, true, true, 'rest']))!
    const last = awarded.state.days[awarded.state.days.length - 1]

    expect(last.milestonesReached).toEqual([{ taskId: 't1', goalId: 'g1', tier: 'bronze' }])
  })

  it('hands out one rank per call, and runs dry when they are all taken', () => {
    // Nine days is bronze, gold and platinum at once with targetDays 3. Two full screens on one
    // tap is the app taking the day over, so the caller comes back for the next after the first.
    let state = makeState(Array(9).fill(true))
    const tiers: string[] = []
    for (let i = 0; i < 5; i += 1) {
      const awarded = awardReachedTier(state)
      if (!awarded) break
      tiers.push(awarded.award.tier)
      state = awarded.state
    }

    expect(tiers).toEqual(['bronze', 'gold', 'platinum'])
    expect(awardReachedTier(state)).toBeNull()
  })

  it('skips an archived goal', () => {
    const state = makeState([true, true, true])
    state.user.goals[0].archived = true

    expect(awardReachedTier(state)).toBeNull()
  })
})
