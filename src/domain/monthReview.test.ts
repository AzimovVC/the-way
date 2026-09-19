import { describe, expect, it } from 'vitest'
import { reviewMonth } from './monthReview'
import type { Day, DayTask } from './models'

// 2026-06-01 is a Monday, so a June built day by day runs Пн Вт Ср … from the 1st.
const JUNE = '2026-06'

function task(isDone: boolean): DayTask {
  return { taskTemplateId: 'tpl', dayId: 'd', isDone, skipped: false, completedAt: null }
}

function makeDay(date: string, rate: number, over: Partial<Day> = {}): Day {
  return {
    id: date,
    date,
    tasks: [task(rate >= 1)],
    completionRate: rate,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: rate >= 1 ? 'gold' : rate > 0 ? 'green' : 'red',
    frozen: false,
    ...over,
  }
}

/** A whole June, `rateFor` deciding each day by its Monday-first weekday index. */
function june(rateFor: (weekday: number, dayOfMonth: number) => number, over: (d: number) => Partial<Day> = () => ({})) {
  return Array.from({ length: 30 }, (_, i) => {
    const dayOfMonth = i + 1
    const date = `${JUNE}-${String(dayOfMonth).padStart(2, '0')}`
    return makeDay(date, rateFor(i % 7, dayOfMonth), over(dayOfMonth))
  })
}

describe('reviewMonth', () => {
  it('has nothing to say about a month the history never reached', () => {
    expect(reviewMonth(june(() => 1), '2026-07')).toBeNull()
  })

  it('answers a month the app was installed halfway through, unlike the week', () => {
    // No floor here on purpose: the screen is never shown unbidden, so somebody tapping a badge
    // they can see is owed an answer even when the month holds three days.
    const tail = june(() => 1).slice(-3)
    const review = reviewMonth(tail, JUNE)!

    expect(review.judgedDays).toBe(3)
    expect(review.goldDays).toBe(3)
    expect(review.start).toBe('2026-06-28')
    expect(review.end).toBe('2026-06-30')
  })

  it('holds excused days apart instead of folding them into the rate', () => {
    // A planned day off is not a weak day. Averaged in as a zero it would invent a slump out of
    // the schedule itself.
    const days = june(() => 1, (d) => (d <= 10 ? { rest: true, tasks: [] } : {}))
    const review = reviewMonth(days, JUNE)!

    expect(review.restDays).toBe(10)
    expect(review.judgedDays).toBe(20)
    expect(review.completionRate).toBe(1)
  })
})

describe('the weekday a month can name and a week cannot', () => {
  it('names the weak end when the month backs it', () => {
    // Saturdays missed, everything else kept. A week holds one Saturday and could not say this.
    const days = june((weekday) => (weekday === 5 ? 0 : 1))
    const review = reviewMonth(days, JUNE)!

    expect(review.weakest?.name).toBe('Суббота')
    expect(review.weakest?.rate).toBe(0)
    // The witness rides in the finding, so the sentence can say how many Saturdays it rests on
    // rather than asserting a rule and hiding how thin it is.
    expect(review.weakest?.sampleCount).toBeGreaterThanOrEqual(4)
    expect(review.weakest?.countedName).toBe('Суббот')
  })

  it('refuses to name a strongest weekday when several tie at the top', () => {
    // The bug this caught on screen: six weekdays at 100% and the screen announced «крепче всего
    // держался вторник». Tuesday did nothing Monday did not. A tied end is no finding.
    const days = june((weekday) => (weekday === 5 ? 0 : 1))
    expect(reviewMonth(days, JUNE)!.strongest).toBeNull()
  })

  it('names both ends only when each is alone at its own', () => {
    // Mondays perfect, Saturdays missed, everything between at half — so both ends stand by
    // themselves and the sentence can carry the pair.
    const days = june((weekday) => (weekday === 0 ? 1 : weekday === 5 ? 0 : 0.5))
    const review = reviewMonth(days, JUNE)!

    expect(review.strongest?.name).toBe('Понедельник')
    expect(review.weakest?.name).toBe('Суббота')
  })

  it('says nothing when every weekday went alike', () => {
    // Something is always last. Without the gap the screen would name a weakest weekday every
    // month without exception, and a month that went evenly would read as one with a problem.
    const days = june(() => 1)
    const review = reviewMonth(days, JUNE)!

    expect(review.strongest).toBeNull()
    expect(review.weakest).toBeNull()
  })

  it('says nothing when the gap is small enough to be one ordinary day', () => {
    const days = june((weekday) => (weekday === 2 ? 0.9 : 1))
    expect(reviewMonth(days, JUNE)!.weakest).toBeNull()
  })

  it('will not let a weekday the month barely held speak for itself', () => {
    // Only the last week of June, so every weekday has one sample. One bad Tuesday is not «Tuesdays».
    const tail = june((weekday) => (weekday === 1 ? 0 : 1)).slice(-7)
    const review = reviewMonth(tail, JUNE)!

    expect(review.judgedDays).toBe(7)
    expect(review.weakest).toBeNull()
  })

  it('does not count a rest day as a weak weekday', () => {
    // Every Sunday off by schedule. Counted as zeroes, Sunday would be named the weakest weekday
    // of every month for anybody who rests on Sundays.
    const days = june((weekday) => (weekday === 6 ? 0 : 1), (d) => {
      const weekday = (d - 1) % 7
      return weekday === 6 ? { rest: true, tasks: [], colorTier: 'rest' } : {}
    })
    const review = reviewMonth(days, JUNE)!

    expect(review.restDays).toBeGreaterThan(0)
    expect(review.weakest).toBeNull()
    expect(review.strongest).toBeNull()
  })
})

describe('the two halves a month is read by', () => {
  it('prints both, so the trend word is never a bare verdict', () => {
    const days = june((_, dayOfMonth) => (dayOfMonth <= 15 ? 0 : 1))
    const review = reviewMonth(days, JUNE)!

    expect(review.hasHalves).toBe(true)
    expect(review.earlyRate).toBe(0)
    expect(review.lateRate).toBe(1)
    expect(review.trend).toBe('improving')
  })

  it('admits a month with nothing to split', () => {
    const one = june(() => 1).slice(0, 1)
    const review = reviewMonth(one, JUNE)!

    expect(review.hasHalves).toBe(false)
    expect(review.judgedDays).toBe(1)
  })
})
