import { describe, expect, it } from 'vitest'
import { MILESTONE_MAX_MISS_STREAK, MILESTONE_ROLLBACK_MULTIPLIER } from './config'
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

function run(pattern: boolean[], task = makeTask()) {
  const days = pattern.map((done, i) =>
    makeDay(`2026-01-${String(5 + i).padStart(2, '0')}`, { tasks: [dayTask(done)] }),
  )
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
      const date = new Date(Date.parse(`${MONDAY}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10)
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

  it('puts the miss streak first, because it is the one nothing later can work off', () => {
    const misses = Array(MILESTONE_MAX_MISS_STREAK + 1).fill(false)
    const progress = run([...Array(20).fill(true), ...misses, ...Array(20).fill(true)])

    expect(progress.longestMissStreak).toBeGreaterThan(MILESTONE_MAX_MISS_STREAK)
    expect(progress.blocker).toBe('missStreak')
  })

  it('reports nothing blocking once the tier is earned', () => {
    const progress = run([true, true, true, true])
    expect(progress.reachedTier).toBe('bronze')
    expect(progress.blocker).toBeNull()
  })

  it('counts the days a miss took back, so a bar at zero can say why', () => {
    const progress = run([true, true, true, true, true, false])

    expect(progress.progressDays).toBe(0)
    // Five earned, five charged — the rollback stops at zero and the report stops with it.
    expect(progress.daysLostToMisses).toBe(5)
  })

  it('never reports more lost than was there to lose', () => {
    const progress = run([true, false])

    expect(MILESTONE_ROLLBACK_MULTIPLIER).toBeGreaterThan(1)
    expect(progress.daysLostToMisses).toBe(1)
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
