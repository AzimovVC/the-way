import { describe, expect, it } from 'vitest'
import type { Day, DayTask } from './models'
import { lastCompleteWeekStart, reviewDay, reviewWeek, weekStartOf } from './review'

// 2026-01-05 is a Monday, so offsets 0..6 run Mon..Sun from here.
const MONDAY = '2026-01-05'

function task(isDone: boolean, skipped = false): DayTask {
  return { id: `t-${Math.random()}`, taskTemplateId: 'tpl', dayId: 'd', isDone, skipped, completedAt: null }
}

function makeDay(date: string, over: Partial<Day> = {}): Day {
  return {
    id: date, date, tasks: [task(true)], completionRate: 1, pathAngleDelta: 0,
    columnDriftX: 0, colorTier: 'gold', frozen: false, ...over,
  }
}

function dateAfter(start: string, offset: number): string {
  const d = new Date(`${start}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function week(tiers: (Day['colorTier'] | 'frozen')[], start = MONDAY): Day[] {
  return tiers.map((tier, i) =>
    makeDay(dateAfter(start, i), {
      colorTier: tier === 'frozen' ? 'rest' : tier,
      frozen: tier === 'frozen',
      rest: tier === 'rest',
      completionRate: tier === 'gold' ? 1 : tier === 'green' ? 0.6 : 0,
      tasks: tier === 'rest' ? [] : [task(tier === 'gold')],
    }),
  )
}

describe('weekStartOf', () => {
  it('walks back to Monday, and leaves Monday where it is', () => {
    expect(weekStartOf(MONDAY)).toBe(MONDAY)
    expect(weekStartOf(dateAfter(MONDAY, 6))).toBe(MONDAY)
    expect(lastCompleteWeekStart(dateAfter(MONDAY, 3))).toBe(dateAfter(MONDAY, -7))
  })
})

describe('reviewDay', () => {
  it('says nothing about a day that is not closed gold', () => {
    const days = week(['green'])
    expect(reviewDay(days, MONDAY)).toBeNull()
  })

  it('says nothing about a day off, even though the road forgives it', () => {
    const days = week(['rest'])
    expect(reviewDay(days, MONDAY)).toBeNull()
  })

  it('counts the streak over a day off instead of letting it break the run', () => {
    const days = week(['gold', 'rest', 'gold'])
    expect(reviewDay(days, dateAfter(MONDAY, 2))?.goldStreak).toBe(2)
  })

  it('calls a streak a record only when nothing earlier was as long', () => {
    const long = week(['gold', 'gold', 'gold', 'red', 'gold', 'gold'])
    expect(reviewDay(long, dateAfter(MONDAY, 5))?.isStreakRecord).toBe(false)
    const longer = week(['gold', 'gold', 'red', 'gold', 'gold', 'gold'])
    expect(reviewDay(longer, dateAfter(MONDAY, 5))?.isStreakRecord).toBe(true)
  })

  it('leaves a skipped task out of the day\'s size, the way the rest of the domain does', () => {
    const days = [makeDay(MONDAY, { tasks: [task(true), task(false, true)] })]
    expect(reviewDay(days, MONDAY)?.taskCount).toBe(1)
  })

  it('says nothing about a day whose only tasks were skipped', () => {
    const days = [makeDay(MONDAY, { tasks: [task(false, true)] })]
    expect(reviewDay(days, MONDAY)).toBeNull()
  })

  it('calls the first gold day the first, not a streak starting over', () => {
    const first = reviewDay(week(['gold']), MONDAY)
    expect(first?.totalGoldDays).toBe(1)
    expect(first?.note).toBe('Первый золотой день на пути.')

    const again = reviewDay(week(['gold', 'red', 'gold']), dateAfter(MONDAY, 2))
    expect(again?.note).toBe('Серия начинается заново.')
  })

  it('counts gold days up to the day being shown, not past it', () => {
    const days = week(['gold', 'gold', 'gold'])
    expect(reviewDay(days, dateAfter(MONDAY, 1))?.totalGoldDays).toBe(2)
  })

  it('counts the week so far against days in the count, not against seven', () => {
    const days = week(['gold', 'rest', 'gold'])
    const review = reviewDay(days, dateAfter(MONDAY, 2))
    expect(review?.goldDaysThisWeek).toBe(2)
    expect(review?.judgedDaysThisWeek).toBe(2)
  })

  it('reads the week from its own Monday, not from the last seven days', () => {
    const days = [...week(['gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold']), ...week(['gold'], dateAfter(MONDAY, 7))]
    expect(reviewDay(days, dateAfter(MONDAY, 7))?.judgedDaysThisWeek).toBe(1)
  })
})

describe('reviewWeek', () => {
  it('says nothing about a week that counted nothing', () => {
    expect(reviewWeek(week(['rest', 'rest']), MONDAY)).toBeNull()
    expect(reviewWeek([], MONDAY)).toBeNull()
  })

  it('stays silent until the week has enough days in the count to be a week', () => {
    expect(reviewWeek(week(['gold', 'red']), MONDAY)).toBeNull()
    expect(reviewWeek(week(['gold', 'red', 'gold']), MONDAY)).not.toBeNull()
  })

  it('does not count rest days toward the threshold', () => {
    expect(reviewWeek(week(['gold', 'rest', 'rest', 'gold']), MONDAY)).toBeNull()
  })

  it('counts excused days apart instead of folding them into the rate', () => {
    const review = reviewWeek(week(['gold', 'gold', 'rest', 'frozen', 'red']), MONDAY)
    expect(review?.judgedDays).toBe(3)
    expect(review?.restDays).toBe(2)
    expect(review?.goldDays).toBe(2)
    expect(review?.completionRate).toBeCloseTo(2 / 3)
  })

  it('draws the week as seven slots, with nothing where the history has nothing', () => {
    const review = reviewWeek(week(['gold', 'red', 'gold']), MONDAY)
    expect(review?.shape).toEqual(['gold', 'red', 'gold', null, null, null, null])
  })

  it('compares with the week before only when that week was judged', () => {
    const alone = reviewWeek(week(['gold', 'red', 'gold']), MONDAY)
    expect(alone?.prevGoldDays).toBeNull()
    expect(alone?.note).toBeNull()

    const days = [...week(['gold', 'red', 'red']), ...week(['gold', 'gold', 'red'], dateAfter(MONDAY, 7))]
    const second = reviewWeek(days, dateAfter(MONDAY, 7))
    expect(second?.prevGoldDays).toBe(1)
    expect(second?.note).toContain('больше')
  })

  it('leaves the full week to the heading instead of saying it twice', () => {
    const review = reviewWeek(week(['gold', 'gold', 'gold', 'rest']), MONDAY)
    expect(review?.goldDays).toBe(review?.judgedDays)
    expect(review?.note).toBeNull()
  })
})
