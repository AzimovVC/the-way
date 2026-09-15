import { describe, expect, it } from 'vitest'
import { computeWeekdayStats, summarizePeriod } from './analytics'
import { buildCalendar, formatMonthTitle, formatShortDate } from './calendar'
import type { Day } from './models'
import { WEEKDAY_LABELS } from './schedule'

// 2026-01-05 is a Monday, so weekday indices 0..6 run Mon..Sun from here.
const MONDAY = '2026-01-05'

function makeDay(date: string, over: Partial<Day> = {}): Day {
  return {
    id: date, date, tasks: [], completionRate: 0, pathAngleDelta: 0,
    columnDriftX: 0, colorTier: 'red', frozen: false, ...over,
  }
}

function dateAfter(start: string, offset: number): string {
  const d = new Date(`${start}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function series(count: number, build: (i: number, date: string) => Partial<Day>, start = MONDAY): Day[] {
  return Array.from({ length: count }, (_, i) => {
    const date = dateAfter(start, i)
    return makeDay(date, build(i, date))
  })
}

describe('computeWeekdayStats', () => {
  it('indexes Monday first, matching the schedule picker', () => {
    const stats = computeWeekdayStats([makeDay(MONDAY, { completionRate: 1 })])
    expect(WEEKDAY_LABELS[stats[0].weekday]).toBe('Пн')
    expect(stats[0].avgCompletionRate).toBe(1)
    expect(stats[6].sampleCount).toBe(0)
  })

  it('leaves excused days out instead of averaging them in as zeros', () => {
    const stats = computeWeekdayStats([
      makeDay(MONDAY, { completionRate: 1 }),
      makeDay(dateAfter(MONDAY, 7), { completionRate: 0, rest: true }),
      makeDay(dateAfter(MONDAY, 14), { completionRate: 0, frozen: true }),
    ])
    expect(stats[0]).toMatchObject({ sampleCount: 1, avgCompletionRate: 1 })
  })
})

describe('summarizePeriod', () => {
  it('counts gold days against the days that were actually asked', () => {
    const days = [
      ...series(3, () => ({ completionRate: 1, colorTier: 'gold' })),
      makeDay(dateAfter(MONDAY, 3), { completionRate: 0, rest: true, colorTier: 'rest' }),
    ]
    expect(summarizePeriod(days)).toMatchObject({ askedDays: 3, goldDays: 3, restDays: 1, completionRate: 1 })
  })

  it('leaves the halves at zero when there is only one judged day to split', () => {
    expect(summarizePeriod([makeDay(MONDAY, { completionRate: 1 })])).toMatchObject({
      earlyRate: 0,
      lateRate: 0,
      trend: 'stable',
    })
  })

  it('returns null when nothing in the period was judged', () => {
    expect(summarizePeriod([makeDay(MONDAY, { rest: true })])).toBeNull()
    expect(summarizePeriod([])).toBeNull()
  })

  it('reads the trend from the two halves, not from the last day', () => {
    const rising = series(10, (i) => ({ completionRate: i < 5 ? 0.2 : 0.9 }))
    expect(summarizePeriod(rising)!).toMatchObject({ trend: 'improving', earlyRate: 0.2, lateRate: 0.9 })

    const falling = series(10, (i) => ({ completionRate: i < 5 ? 0.9 : 0.2 }))
    expect(summarizePeriod(falling)!.trend).toBe('declining')

    // One weak day at the end of a long strong stretch is not a decline: the halves are averages,
    // so a single day has to be worth a tenth of its half to move the verdict.
    const blip = series(20, (i) => ({ completionRate: i === 19 ? 0 : 1 }))
    expect(summarizePeriod(blip)!.trend).toBe('stable')
  })

  it('names the latest incomplete day, ignoring excused ones', () => {
    const days = [
      makeDay(MONDAY, { completionRate: 0.5 }),
      makeDay(dateAfter(MONDAY, 1), { completionRate: 1, colorTier: 'gold' }),
      makeDay(dateAfter(MONDAY, 2), { completionRate: 0, rest: true }),
    ]
    expect(summarizePeriod(days)!.lastMissDate).toBe(MONDAY)
  })
})

describe('buildCalendar', () => {
  it('pads the week so the columns are weekdays', () => {
    // 2026-01-01 is a Thursday: three empty cells before it.
    const [month] = buildCalendar([makeDay('2026-01-02', { completionRate: 1 })])
    expect(month.key).toBe('2026-01')
    expect(month.weeks[0].slice(0, 3).every((c) => c.date === null)).toBe(true)
    expect(month.weeks[0][3].date).toBe('2026-01-01')
    expect(month.weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('keeps a cell for every date inside the covered stretch', () => {
    const months = buildCalendar([makeDay('2026-01-08'), makeDay('2026-01-20')])
    const dated = months[0].weeks.flat().filter((c) => c.date !== null)
    // The weeks of the 8th and the 20th, and the one between them: 5 → 25 January.
    expect(dated.map((c) => c.date)).toEqual(
      Array.from({ length: 21 }, (_, i) => `2026-01-${String(i + 5).padStart(2, '0')}`),
    )
    expect(dated.filter((c) => c.day !== undefined)).toHaveLength(2)
  })

  it('drops the whole weeks before the history starts and after it ends', () => {
    const [month] = buildCalendar([makeDay('2026-01-20')])
    expect(month.weeks).toHaveLength(1)
    expect(month.weeks[0][0].date).toBe('2026-01-19')
  })

  it('orders months oldest first', () => {
    const months = buildCalendar([makeDay('2026-02-01'), makeDay('2025-12-31')])
    expect(months.map((m) => m.key)).toEqual(['2025-12', '2026-02'])
  })
})

describe('date formatting', () => {
  it('writes dates the way they are read', () => {
    expect(formatShortDate('2026-08-25')).toBe('25 авг')
    expect(formatMonthTitle('2026-09', 2026)).toBe('Сентябрь')
    expect(formatMonthTitle('2025-09', 2026)).toBe('Сентябрь 2025')
  })
})
