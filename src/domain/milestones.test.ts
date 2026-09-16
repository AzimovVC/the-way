import { describe, expect, it } from 'vitest'
import { MILESTONE_COMEBACK_GAIN, MILESTONE_MISS_COST_BY_STREAK } from './config'
import { buildCycleReport, computeMilestoneProgress, projectedArrivalDate } from './milestones'
import { rankReachedAt } from './ranks'
import type { Day, TaskTemplate } from './models'
import { nextScheduledDate, readTaskToday } from './schedule'

const MONDAY = '2026-01-05'

function makeTask(over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 't1', goalId: 'g1', title: 'Пробежка', frequency: 'daily', habitLevel: 0,
    habitExp: 0, cycleStartDate: MONDAY, ...over,
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

describe('the day count against the ladder', () => {
  it('takes the days at face value, whatever the average reads', () => {
    // A Mon/Wed/Fri task over eight weeks, missing every fourth asked day: 75% — under the gate
    // this used to have to clear. The days are in, so the rank is in: the misses were already
    // charged against the day count, and charging them again against an average that no later
    // work could lift was a second verdict on the same slips.
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
    expect(progress.currentRank?.id).toBe('apprentice')
  })

  it('does not bar a rank for a long run of misses — the run already cost its days', () => {
    const progress = run([...Array(20).fill(true), ...Array(4).fill(false), ...Array(5).fill(true)])

    expect(progress.longestMissStreak).toBe(4)
    expect(progress.currentRank?.id).toBe('apprentice')
  })

  it('reads levels off the shared ladder and nothing else', () => {
    // A level is a duration: the same seven days for a habit someone calls easy and one they call
    // hard. There is no second finish underneath any more for it to disagree with.
    const progress = run(Array(6).fill(true))

    expect(progress.currentRank).toBeNull()
    expect(progress.nextRank).toMatchObject({ id: 'novice', days: 7 })
  })

  it('counts from one start, so the days keep running past every rung', () => {
    const progress = run(Array(24).fill(true))

    expect(progress.progressDays).toBe(24)
    expect(progress.currentRank).toMatchObject({ id: 'apprentice', days: 21 })
    expect(progress.nextRank).toMatchObject({ id: 'practitioner', days: 66 })
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
    // The run was charged as a run — first miss free, then 1, then 2 — and not as three separate
    // first misses, which would have cost nothing at all. Only 2 of that 3 landed: the habit was
    // already standing on «Новичок», and the floor stopped the charge at the rung.
    expect(progress.daysLostToMisses).toBe(2)
    expect(progress.floorDays).toBe(7)
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

describe('the report the rank screen prints', () => {
  /** A Mon/Wed/Fri habit over `weeks` weeks, every asked day done, the rest of the week off. */
  function perfectScheduledRun(weeks: number): Day[] {
    const days: Day[] = []
    for (let i = 0; i < weeks * 7; i += 1) {
      const asked = [0, 2, 4].includes(i % 7)
      days.push(makeDay(dateAt(i), asked ? { tasks: [dayTask(true)] } : { rest: true }))
    }
    return days
  }

  it('counts no misses for a habit that never missed a day it was asked on', () => {
    // The bug this replaces: the report called every day that was not done and not frozen a miss,
    // so a flawless Пн Ср Пт habit reaching «Практик» was shown twenty-eight missed days — the
    // Tuesdays, Thursdays and weekends it was never due on.
    const task = makeTask({ weekdays: [0, 2, 4] })
    const days = perfectScheduledRun(10)
    const progress = computeMilestoneProgress(task, days)
    const report = buildCycleReport(task, progress, { rank: rankReachedAt(progress.progressDays)! })

    expect(report.missedDays).toBe(0)
    expect(report.missStreakCount).toBe(0)
    expect(report.message).toContain('ни разу не сорвался')
  })

  it('agrees with the day count about which days were missed', () => {
    // The two readings of the same history must not disagree: the arithmetic hands out the rank,
    // the report explains it, and a screen that contradicts the bar it stands on is worse than no
    // screen. Пн Ср Пт, three asked days missed in a row, the rest done.
    const task = makeTask({ weekdays: [0, 2, 4] })
    const days = perfectScheduledRun(10)
    for (const i of [21, 23, 25]) days[i] = makeDay(dateAt(i), { tasks: [dayTask(false)] })

    const progress = computeMilestoneProgress(task, days)
    const report = buildCycleReport(task, progress, { rank: rankReachedAt(progress.progressDays)! })

    expect(report.missedDays).toBe(3)
    // One run, not three: the Tuesday and Thursday between them were never asked for, and cutting
    // the run there would make three sorted-out runs each cost a first miss — which costs nothing.
    expect(report.missStreakCount).toBe(1)
    expect(progress.longestMissStreak).toBe(3)
  })

  it('does not count a freeze spent on a day the habit was not asked on', () => {
    const task = makeTask({ weekdays: [0, 2, 4] })
    const days = perfectScheduledRun(4)
    days[1] = makeDay(dateAt(1), { rest: true, frozen: true })
    days[2] = makeDay(dateAt(2), { tasks: [dayTask(false)], frozen: true })

    const progress = computeMilestoneProgress(task, days)
    const report = buildCycleReport(task, progress, { rank: progress.nextRank })

    expect(report.freezesUsed).toBe(1)
    expect(report.missedDays).toBe(0)
  })
})

describe('a rank once stood on is never taken back', () => {
  /** `days` done in a row, then `misses` asked days missed in a row. */
  function runThenMiss(done: number, misses: number, task = makeTask()) {
    const pattern = [...Array(done).fill(true), ...Array(misses).fill(false)]
    return computeMilestoneProgress(task, pattern.map((d, i) => makeDay(dateAt(i), { tasks: [dayTask(d)] })))
  }

  it('erodes the count inside a rung, which is the decay the cost exists to model', () => {
    const progress = runThenMiss(20, 4)
    // Standing at «Новичок» with 20 days: 13 above the rung, and four misses cost 0+1+2+3.
    expect(progress.floorDays).toBe(7)
    expect(progress.progressDays).toBe(20 - 6)
    expect(progress.daysLostToMisses).toBe(6)
  })

  it('stops the erosion at the rung, however long the gap runs', () => {
    // Twenty days is «Ученик» minus one, so the floor is «Новичок» at 7. A month of misses cannot
    // push it below: the one thing the app had already said out loud stays said.
    const long = runThenMiss(20, 30)
    expect(long.progressDays).toBe(7)
    expect(long.currentRank?.id).toBe('novice')
  })

  it('does not demote a habit of months for a bad fortnight', () => {
    const practitioner = runThenMiss(70, 14)
    expect(practitioner.currentRank?.id).toBe('practitioner')
    expect(practitioner.progressDays).toBeGreaterThanOrEqual(66)
  })

  it('never charges for ground it will not take, so there is no debt to win back twice', () => {
    // The floor caps the debt for the same reason zero does: days that cannot be taken are not
    // days a comeback can repay, and paying double for them would be a gift.
    const long = runThenMiss(20, 30)
    expect(long.daysLostToMisses).toBe(13)
  })


  it('protects a rung with the very day that took it', () => {
    // The floor is read after the day, not before it: a habit that reaches 7 and then misses must
    // not be charged back off the rung it took that morning.
    const progress = runThenMiss(7, 5)
    expect(progress.progressDays).toBe(7)
  })
})

describe('the day the bar fills', () => {
  it('is today plus what is left when nothing is owed', () => {
    expect(projectedArrivalDate('2026-09-16', 10, 0)).toBe('2026-09-26')
  })

  it('is not moved by ground still owed — winning it back is exactly as fast as losing it was', () => {
    // 30 days of walking either way: the comeback day is worth two, so the three days owed close
    // themselves on the way. A break costs the days it ate, not a second penalty on top.
    expect(projectedArrivalDate('2026-09-16', 30, 0)).toBe(projectedArrivalDate('2026-09-16', 33, 3))
  })

  it('counts the doubled days when the debt is bigger than what is left', () => {
    // Four days to go, plenty owed: two days at +2 finish it.
    expect(projectedArrivalDate('2026-09-16', 4, 10)).toBe('2026-09-18')
  })

  it('is today itself when there is nothing left to walk', () => {
    expect(projectedArrivalDate('2026-09-16', 0, 0)).toBe('2026-09-16')
  })
})
