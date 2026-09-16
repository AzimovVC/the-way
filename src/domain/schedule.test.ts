import { describe, expect, it } from 'vitest'
import { computeMilestoneProgress } from './milestones'
import type { Day, TaskTemplate } from './models'
import { describeSchedule, isDayExcused, isTaskScheduledOn, weekdayIndex } from './schedule'
import { applyPathGeometry } from './pathEngine'
import { computeStreak } from './analytics'

// 2026-01-05 is a Monday, so index 0..6 runs Mon..Sun across that week.
const MONDAY = '2026-01-05'
const SATURDAY = '2026-01-10'

function makeTask(over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 't1', goalId: 'g1', title: 'Пробежка', cycleStartDate: MONDAY, ...over,
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

describe('weekdays', () => {
  it('reads a calendar date as a Monday-first index, in UTC, so no timezone shifts the week', () => {
    expect(weekdayIndex(MONDAY)).toBe(0)
    expect(weekdayIndex(SATURDAY)).toBe(5)
    expect(weekdayIndex('2026-01-11')).toBe(6)
  })

  it('treats a task with no schedule as every day — that is what every older task means', () => {
    expect(isTaskScheduledOn(makeTask(), SATURDAY)).toBe(true)
    expect(isTaskScheduledOn(makeTask({ weekdays: [] }), SATURDAY)).toBe(true)
  })

  it('asks for the task only on its own days', () => {
    const task = makeTask({ weekdays: [0, 2, 4] })
    expect(isTaskScheduledOn(task, MONDAY)).toBe(true)
    expect(isTaskScheduledOn(task, SATURDAY)).toBe(false)
  })

  it('says the schedule in words the way the screens show it', () => {
    expect(describeSchedule(undefined)).toBe('Каждый день')
    expect(describeSchedule([0, 1, 2, 3, 4, 5, 6])).toBe('Каждый день')
    expect(describeSchedule([4, 0, 2])).toBe('Пн Ср Пт')
  })
})

describe('a day off', () => {
  it('is excused, like a frozen day', () => {
    expect(isDayExcused(makeDay(MONDAY, { rest: true }))).toBe(true)
    expect(isDayExcused(makeDay(MONDAY, { frozen: true }))).toBe(true)
    expect(isDayExcused(makeDay(MONDAY))).toBe(false)
  })

  it('does not steer the road down the way a missed day does', () => {
    // The same two good days, then one empty day read two ways. pathAngleDelta is the smoothed
    // trend, so what matters is the difference between the two readings, not an absolute zero.
    const history = (last: Partial<Day>) => [
      makeDay('2026-01-05', { tasks: [dayTask(true)], completionRate: 1 }),
      makeDay('2026-01-06', { tasks: [dayTask(true)], completionRate: 1 }),
      makeDay('2026-01-07', last),
    ]
    const rested = applyPathGeometry(history({ rest: true }))[2]
    const missed = applyPathGeometry(history({ tasks: [dayTask(false)], completionRate: 0 }))[2]

    expect(rested.pathAngleDelta).toBeGreaterThan(missed.pathAngleDelta)
    // And an empty day is painted as a day off — not as a failure, and not as a gap in the record.
    expect(rested.colorTier).toBe('rest')
    expect(missed.colorTier).toBe('red')
  })

  it('does not break the streak', () => {
    const days = applyPathGeometry([
      makeDay('2026-01-05', { tasks: [dayTask(true)], completionRate: 1 }),
      makeDay('2026-01-06', { rest: true }),
      makeDay('2026-01-07', { tasks: [dayTask(true)], completionRate: 1 }),
    ])

    expect(computeStreak(days).currentGoldStreak).toBe(2)
  })
})

describe('milestones under a schedule', () => {
  const task = makeTask({ weekdays: [0, 2, 4] })

  it('counts a day the task was never asked for as a day passed, not a day lost', () => {
    // Mon done, Tue off duty (the day exists and asks for something else), Wed done.
    const days = [
      makeDay('2026-01-05', { tasks: [dayTask(true)] }),
      makeDay('2026-01-06', { tasks: [{ ...dayTask(false), taskTemplateId: 'other' }] }),
      makeDay('2026-01-07', { tasks: [dayTask(true)] }),
    ]

    expect(computeMilestoneProgress(task, days).progressDays).toBe(3)
  })

  it('counts a rest day the same way', () => {
    const days = [
      makeDay('2026-01-05', { tasks: [dayTask(true)] }),
      makeDay('2026-01-06', { rest: true }),
    ]

    expect(computeMilestoneProgress(task, days).progressDays).toBe(2)
  })

  it('still counts a day the app was never opened as a miss', () => {
    // No tasks and no rest flag: nothing is known about this day, and it is not a day off.
    const days = [makeDay('2026-01-05', { tasks: [dayTask(true)] }), makeDay('2026-01-06')]

    const progress = computeMilestoneProgress(task, days)

    // Measured as «asked and not done», not by the size of the penalty: an isolated miss costs
    // nothing now, so a day off and a missed day would look alike through progressDays alone.
    expect(progress.avgCompletionRate).toBe(0.5)
    expect(progress.longestMissStreak).toBe(1)
    // And it did not quietly earn the +1 that a genuine day off earns.
    expect(progress.progressDays).toBe(1)
  })

  it('reads the honesty gate over the days the task was asked for, not over the calendar', () => {
    const days = [
      makeDay('2026-01-05', { tasks: [dayTask(true)] }),
      makeDay('2026-01-06', { rest: true }),
      makeDay('2026-01-07', { tasks: [dayTask(true)] }),
      makeDay('2026-01-08', { rest: true }),
    ]

    // Two asked, two done: a perfect record, even though half the calendar is empty.
    expect(computeMilestoneProgress(task, days).avgCompletionRate).toBe(1)
  })

  it('lets a freeze hold the line without advancing it', () => {
    const days = [
      makeDay('2026-01-05', { tasks: [dayTask(true)] }),
      makeDay('2026-01-06', { tasks: [dayTask(false)], frozen: true }),
    ]
    const progress = computeMilestoneProgress(task, days)

    expect(progress.progressDays).toBe(1)
    expect(progress.longestMissStreak).toBe(0)
  })
})
