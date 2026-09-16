import { describe, expect, it } from 'vitest'
import { computeStreak } from './analytics'
import type { ColorTier, Day } from './models'
import { streakIndex, streakOverview, streakRuns } from './streak'

const START = '2026-09-01'

function dateAt(offset: number): string {
  return new Date(Date.parse(`${START}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
}

/**
 * '*' a gold day, 'x' a missed one, '-' a day nothing was recorded for, '.' a rest day,
 * 'f' a spent freeze. The last two are the pair `isDayExcused` treats alike.
 */
function road(shape: string): Day[] {
  return [...shape].map((c, i) => {
    const tier: ColorTier = c === '*' ? 'gold' : c === 'x' ? 'red' : c === '-' ? 'gray' : 'rest'
    return {
      id: dateAt(i),
      date: dateAt(i),
      tasks: [],
      completionRate: c === '*' ? 1 : 0,
      pathAngleDelta: 0,
      columnDriftX: 0,
      colorTier: tier,
      frozen: c === 'f',
      rest: c === '.' ? true : undefined,
    }
  })
}

describe('streak runs', () => {
  it('breaks a run on a day that was counted and missed', () => {
    const runs = streakRuns(road('***x**'))

    expect(runs.map((r) => r.length)).toEqual([3, 2])
    expect(runs[0].startDate).toBe(dateAt(0))
    expect(runs[0].endDate).toBe(dateAt(2))
    expect(runs[0].current).toBe(false)
    expect(runs[1].current).toBe(true)
  })

  it('breaks on a day nothing was recorded for — a hole is not a day off', () => {
    expect(streakRuns(road('***-**')).map((r) => r.length)).toEqual([3, 2])
  })

  it('steps over a rest day and a freeze alike, and neither adds to the length', () => {
    const runs = streakRuns(road('**.f**'))

    expect(runs).toHaveLength(1)
    expect(runs[0].length).toBe(4)
    expect(runs[0].bridgedDates).toEqual([dateAt(2), dateAt(3)])
    // The line is drawn through them, so the span is longer than the count.
    expect(runs[0].startDate).toBe(dateAt(0))
    expect(runs[0].endDate).toBe(dateAt(5))
  })

  it('does not reach past the last gold day when the history ends on a day off', () => {
    const runs = streakRuns(road('***..'))

    expect(runs[0].endDate).toBe(dateAt(2))
    expect(runs[0].bridgedDates).toEqual([])
    // Still the streak being stood in: a day off did not end it.
    expect(runs[0].current).toBe(true)
  })

  it('gives a day off before the first gold day to nobody', () => {
    const runs = streakRuns(road('..**'))

    expect(runs).toHaveLength(1)
    expect(runs[0].startDate).toBe(dateAt(2))
    expect(runs[0].bridgedDates).toEqual([])
  })

  it('has no runs at all in a history without a gold day', () => {
    expect(streakRuns(road('xx.-x'))).toEqual([])
  })
})

describe('streak overview', () => {
  it('reads the current streak exactly as the header chip does', () => {
    for (const shape of ['***x**', '**.f**', '***..', 'xxx', '', '*']) {
      expect(streakOverview(road(shape)).current).toBe(computeStreak(road(shape)).currentGoldStreak)
    }
  })

  it('keeps the longest stretch even after it has been broken', () => {
    const overview = streakOverview(road('*****x**'))

    expect(overview.current).toBe(2)
    expect(overview.best).toBe(5)
    expect(overview.totalGoldDays).toBe(7)
    expect(overview.currentStartDate).toBe(dateAt(6))
  })

  it('has no current start date when the last counted day was a miss', () => {
    const overview = streakOverview(road('***x'))

    expect(overview.current).toBe(0)
    expect(overview.currentStartDate).toBeNull()
    expect(overview.best).toBe(3)
  })
})

describe('the calendar index', () => {
  it('marks the ends of the stretch, not the ends of a week', () => {
    const index = streakIndex(streakRuns(road('*.*')))

    expect(index.get(dateAt(0))).toEqual({ kind: 'gold', start: true, end: false })
    expect(index.get(dateAt(1))).toEqual({ kind: 'bridged', start: false, end: false })
    expect(index.get(dateAt(2))).toEqual({ kind: 'gold', start: false, end: true })
  })

  it('leaves a day outside every stretch unmarked', () => {
    const index = streakIndex(streakRuns(road('*x*')))

    expect(index.has(dateAt(1))).toBe(false)
    expect(index.get(dateAt(0))).toEqual({ kind: 'gold', start: true, end: true })
  })
})
