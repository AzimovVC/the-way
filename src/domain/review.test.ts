import { describe, expect, it } from 'vitest'
import type { Day, DayTask } from './models'
import { lastCompleteWeekStart, reviewDay, reviewWeek, weekStartOf } from './review'

// 2026-01-05 is a Monday, so offsets 0..6 run Mon..Sun from here.
const MONDAY = '2026-01-05'

function task(isDone: boolean): DayTask {
  return { id: `t-${Math.random()}`, taskTemplateId: 'tpl', dayId: 'd', isDone, skipped: false, completedAt: null }
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

  it('counts the week so far against judged days, not against seven', () => {
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
  it('says nothing about a week that judged nothing', () => {
    expect(reviewWeek(week(['rest', 'rest']), MONDAY)).toBeNull()
    expect(reviewWeek([], MONDAY)).toBeNull()
  })

  it('counts excused days apart instead of folding them into the rate', () => {
    const review = reviewWeek(week(['gold', 'gold', 'rest', 'frozen', 'red']), MONDAY)
    expect(review?.judgedDays).toBe(3)
    expect(review?.restDays).toBe(2)
    expect(review?.goldDays).toBe(2)
    expect(review?.completionRate).toBeCloseTo(2 / 3)
  })

  it('draws the week as seven slots, with nothing where the history has nothing', () => {
    const review = reviewWeek(week(['gold', 'red']), MONDAY)
    expect(review?.shape).toEqual(['gold', 'red', null, null, null, null, null])
  })

  it('compares with the week before only when that week was judged', () => {
    const alone = reviewWeek(week(['gold', 'red']), MONDAY)
    expect(alone?.prevGoldDays).toBeNull()

    const days = [...week(['gold', 'red', 'red']), ...week(['gold', 'gold', 'red'], dateAfter(MONDAY, 7))]
    const second = reviewWeek(days, dateAfter(MONDAY, 7))
    expect(second?.prevGoldDays).toBe(1)
    expect(second?.note).toContain('больше')
  })

  it('calls a week with no miss closed, whatever the rest days did', () => {
    const review = reviewWeek(week(['gold', 'gold', 'rest']), MONDAY)
    expect(review?.note).toBe('Неделя закрыта полностью.')
  })
})
