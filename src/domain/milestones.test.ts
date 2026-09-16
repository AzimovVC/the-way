import { describe, expect, it } from 'vitest'
import {
  MILESTONE_COMEBACK_GAIN,
  MILESTONE_MAX_MISS_STREAK,
  MILESTONE_MISS_COST_BY_STREAK,
  MILESTONE_MISS_STREAK_FORGIVE_DAYS,
} from './config'
import { computeMilestoneProgress } from './milestones'
import type { Day, TaskTemplate } from './models'
import { nextScheduledDate, readTaskToday } from './schedule'

const MONDAY = '2026-01-05'

function makeTask(over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 't1', goalId: 'g1', title: 'Пробежка', frequency: 'daily', habitLevel: 0,
    habitExp: 0, targetDays: 3, currentTier: 'none', cycleStartDate: MONDAY, ...over,
  }
}

function makeDay(date: string, over: Partial<Day> = {}): Day {
  return {
    id: date, date, tasks: [], completionRate: 0, pathAngleDelta: 0,
    columnDriftX: 0, colorTier: 'red', frozen: false, ...over,
  }
}

const dayTask = (isDone: boolean) => ({
  id: `dt-${isDone}`, taskTemplateId: 't1', dayId: 'd', isDone, skipped: false, completedAt: null,
})

/** Real date arithmetic, not «2026-01-» plus an index: past the 31st that yields dates that parse
 *  to NaN, and every comparison against them quietly answers false. */
function dateAt(offset: number): string {
  return new Date(Date.parse(`${MONDAY}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
}

function run(pattern: boolean[], task = makeTask()) {
  const days = pattern.map((done, i) => makeDay(dateAt(i), { tasks: [dayTask(done)] }))
  return computeMilestoneProgress(task, days)
}

describe('milestone blocker', () => {
  it('names the honesty gate, not the day count, once the days are in', () => {
    // A Mon/Wed/Fri task over eight weeks, missing every fourth asked day: 75%, short of the gate.
    // The surplus comes from the days the task was never asked for — those earn their +1 too, which
    // is exactly how a card can show «134 / 66 дн.» beside a milestone that is not coming.
    const task = makeTask({ weekdays: [0, 2, 4] })
    const days: Day[] = []
    let asked = 0
    for (let i = 0; i < 56; i += 1) {
      const date = dateAt(i)
      if ([0, 2, 4].includes(i % 7)) {
        asked += 1
        days.push(makeDay(date, { tasks: [dayTask(asked % 4 !== 0)] }))
      } else {
        days.push(makeDay(date, { rest: true }))
      }
    }
    const progress = computeMilestoneProgress(task, days)

    expect(progress.avgCompletionRate).toBe(0.75)

    expect(progress.progressDays).toBeGreaterThan(progress.nextTierTarget ?? 0)
    expect(progress.reachedTier).toBeNull()
    // Without this the card draws a full day bar beside a milestone that is not coming.
    expect(progress.blocker).toBe('rate')
  })

  it('names the day count while the days are still short', () => {
    expect(run([true, true]).blocker).toBe('days')
  })

  it('puts the miss streak first, while it is young enough to count', () => {
    const misses = Array(MILESTONE_MAX_MISS_STREAK + 1).fill(false)
    const progress = run([...Array(20).fill(true), ...misses, ...Array(5).fill(true)])

    expect(progress.blockingMissStreak).toBeGreaterThan(MILESTONE_MAX_MISS_STREAK)
    expect(progress.blocker).toBe('missStreak')
  })

  it('lets a run of misses age out, so a bad week is not a life sentence', () => {
    // The cycle only restarts when a tier is taken, so a streak that never ages out closes the
    // tier for good — and no habit research supports a gap erasing what was built.
    const misses = Array(MILESTONE_MAX_MISS_STREAK + 1).fill(false)
    const since = Array(MILESTONE_MISS_STREAK_FORGIVE_DAYS + 1).fill(true)
    const progress = run([...Array(20).fill(true), ...misses, ...since])

    expect(progress.longestMissStreak).toBeGreaterThan(MILESTONE_MAX_MISS_STREAK)
    expect(progress.blockingMissStreak).toBe(0)
    expect(progress.reachedTier).toBe('bronze')
  })

  it('reports nothing blocking once the tier is earned', () => {
    const progress = run([true, true, true, true])
    expect(progress.reachedTier).toBe('bronze')
    expect(progress.blocker).toBeNull()
  })

  it('charges nothing for a single miss, which is what the study measured', () => {
    // Lally et al. 2010: missing one opportunity did not materially affect the automaticity curve.
    expect(MILESTONE_MISS_COST_BY_STREAK[0]).toBe(0)
    const progress = run([true, true, true, false])

    expect(progress.progressDays).toBe(3)
    expect(progress.daysLostToMisses).toBe(0)
  })

  it('charges a gap more the longer it runs, and then stops growing', () => {
    const costs = MILESTONE_MISS_COST_BY_STREAK
    const deep = run([...Array(20).fill(true), false, false, false, false, false])
    const total = costs.reduce((sum, c) => sum + c, 0) + costs[costs.length - 1]

    expect(deep.progressDays).toBe(20 - total)
    expect(deep.daysLostToMisses).toBe(total)
  })

  it('never charges ground that was never there', () => {
    const progress = run([false, false, false, false])

    expect(progress.progressDays).toBe(0)
    // A comeback bonus for days never earned would be a gift, not a repayment.
    expect(progress.daysLostToMisses).toBe(0)
  })

  it('pays a comeback double until the lost ground is back, and not a day longer', () => {
    // Three misses in a row take 0 + 1 + 2 = 3 days; three days back win exactly those three.
    const lost = run([...Array(10).fill(true), false, false, false])
    expect(lost.daysLostToMisses).toBe(3)
    expect(lost.isComingBack).toBe(true)

    const back = run([...Array(10).fill(true), false, false, false, true, true, true])
    expect(back.progressDays).toBe(10 + MILESTONE_COMEBACK_GAIN * 3 - 3)
    expect(back.daysLostToMisses).toBe(0)
    expect(back.isComingBack).toBe(false)

    // Past the debt the day is an ordinary day again.
    const beyond = run([...Array(10).fill(true), false, false, false, true, true, true, true])
    expect(beyond.progressDays).toBe(back.progressDays + 1)
  })

  it('measures the gap in times asked, not in squares of the calendar', () => {
    // A Mon/Wed/Fri task, three runs skipped in a row. The days between are off duty, and if they
    // reset the run each skip is charged as a first miss — which costs nothing — so a task with a
    // schedule could never build a gap at all.
    const task = makeTask({ weekdays: [0, 2, 4] })
    const days: Day[] = []
    for (let i = 0; i < 14; i += 1) {
      const date = dateAt(i)
      if ([0, 2, 4].includes(i % 7)) days.push(makeDay(date, { tasks: [dayTask(i < 7)] }))
      else days.push(makeDay(date, { rest: true }))
    }
    const progress = computeMilestoneProgress(task, days)

    expect(progress.longestMissStreak).toBe(3)
    expect(progress.daysLostToMisses).toBe(MILESTONE_MISS_COST_BY_STREAK.slice(0, 3).reduce((a, b) => a + b, 0))
  })

  it('leaves the honesty gate the only judge of how much was done', () => {
    // A daily task missing one day a week averages 86% — past the gate — and used to net +1 a
    // week, putting a 66-day tier fifteen months out. Now the week is worth what it looks worth.
    const week = [true, true, true, true, true, true, false]
    const progress = run([...week, ...week, ...week, ...week])

    expect(progress.avgCompletionRate).toBeGreaterThan(0.8)
    expect(progress.progressDays).toBe(24)
  })
})

describe('what the task asks today', () => {
  const monWedFri = makeTask({ weekdays: [0, 2, 4] })

  it('separates a mark made from a mark still owed', () => {
    const done = makeDay(MONDAY, { tasks: [dayTask(true)] })
    const owed = makeDay(MONDAY, { tasks: [dayTask(false)] })

    expect(readTaskToday(monWedFri, done, MONDAY).kind).toBe('done')
    expect(readTaskToday(monWedFri, owed, MONDAY).kind).toBe('pending')
  })

  it('reads a day off the same way whether the schedule skipped it or the day rested', () => {
    const skipped = makeDay('2026-01-06', { tasks: [] })
    const rested = makeDay('2026-01-06', { rest: true, tasks: [] })

    expect(readTaskToday(monWedFri, skipped, '2026-01-06').kind).toBe('offDuty')
    expect(readTaskToday(monWedFri, rested, '2026-01-06').kind).toBe('offDuty')
  })

  it('says when the task comes back, so a day off does not read as a task that stopped', () => {
    const tuesday = readTaskToday(monWedFri, makeDay('2026-01-06'), '2026-01-06')

    expect(tuesday).toEqual({ kind: 'offDuty', nextDate: '2026-01-07' })
  })

  it('looks forward from the day after, never answering with today', () => {
    // Monday is a scheduled day, and «снова в понедельник» about today would be nonsense.
    expect(nextScheduledDate(monWedFri, MONDAY)).toBe('2026-01-07')
    expect(nextScheduledDate(makeTask(), MONDAY)).toBe('2026-01-06')
  })
})
