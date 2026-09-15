import type { ColorTier, Day } from './models'
import { addDaysISO } from './pathEngine'
import { isDayExcused, weekdayIndex } from './schedule'

/**
 * The two moments the road stops and speaks: a day that just closed gold, and a week that just
 * ended. Everything here is a count over days that already exist — no new state is stored, and
 * nothing read here feeds back into geometry, colour or milestones.
 *
 * Only a **closed** day gets a screen. A day that came up short has no moment to be shown at: it
 * ends at 3:00 with nobody looking, and a screen that opened the next morning to say what was
 * missed would be the dark half the app does not have. The road already draws it.
 */

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** The Monday of the week a date falls in — Monday-first, like every other week in the app. */
export function weekStartOf(date: string): string {
  return addDaysISO(date, -weekdayIndex(date))
}

/**
 * Gold days in a row ending at `index`, excused days stepped over rather than counted.
 *
 * The same rule as computeStreak, read from a given day rather than from the end of the history:
 * a day off does not extend the streak and does not break it, because it was never a result.
 */
function goldStreakEndingAt(sorted: Day[], index: number): number {
  let streak = 0
  for (let i = index; i >= 0; i--) {
    if (isDayExcused(sorted[i])) continue
    if (sorted[i].colorTier !== 'gold') break
    streak++
  }
  return streak
}

/** The longest gold streak anywhere in the given days — what a new streak has to beat to be a record. */
function longestGoldStreak(sorted: Day[]): number {
  let best = 0
  let current = 0
  for (const day of sorted) {
    if (isDayExcused(day)) continue
    if (day.colorTier === 'gold') {
      current++
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  return best
}

export interface DayReview {
  date: string
  /** Tasks the day asked for, all of them done — that is the condition for this screen existing. */
  taskCount: number
  goldStreak: number
  /** True when no earlier stretch of this history was this long. */
  isStreakRecord: boolean
  goldDaysThisWeek: number
  /** Days of this week that were actually judged, so the week line is «4 из 5», not «4 из 7». */
  judgedDaysThisWeek: number
  /** One line of context, or nothing. Never a verdict — the day is already closed and gold. */
  note: string | null
}

/**
 * The day's own summary, or null when the day has nothing to celebrate: it is excused, it asked
 * for nothing, or something in it is still open. The caller is expected to show this at the
 * moment the last task is marked, not on the next open — see the note at the top of the file.
 */
export function reviewDay(days: Day[], dayId: string): DayReview | null {
  const sorted = sortedByDate(days)
  const index = sorted.findIndex((d) => d.id === dayId)
  if (index === -1) return null

  const day = sorted[index]
  if (isDayExcused(day) || day.tasks.length === 0 || day.colorTier !== 'gold') return null

  const goldStreak = goldStreakEndingAt(sorted, index)
  const isStreakRecord = goldStreak > longestGoldStreak(sorted.slice(0, index))

  const weekStart = weekStartOf(day.date)
  const weekSoFar = sorted.filter((d) => d.date >= weekStart && d.date <= day.date)
  const judged = weekSoFar.filter((d) => !isDayExcused(d))
  const goldDaysThisWeek = judged.filter((d) => d.colorTier === 'gold').length

  return {
    date: day.date,
    taskCount: day.tasks.length,
    goldStreak,
    isStreakRecord,
    goldDaysThisWeek,
    judgedDaysThisWeek: judged.length,
    note: dayNote(goldStreak, isStreakRecord, goldDaysThisWeek, judged.length),
  }
}

function dayNote(streak: number, isRecord: boolean, weekGold: number, weekJudged: number): string | null {
  if (isRecord && streak > 1) return 'Такой длинной серии у тебя ещё не было.'
  if (streak === 1) return 'Серия начинается заново.'
  if (weekJudged >= 3 && weekGold === weekJudged) return 'Неделя пока идёт без единого пропуска.'
  return null
}

export interface WeekReview {
  /** Monday and Sunday of the week, as date keys. */
  start: string
  end: string
  goldDays: number
  /** Days the week actually judged — excused ones are counted apart, never folded in. */
  judgedDays: number
  restDays: number
  /** Mean completion over the judged days, 0..1. */
  completionRate: number
  /** Gold days of the week before, or null when that week judged nothing and has nothing to compare. */
  prevGoldDays: number | null
  goldStreakAtEnd: number
  /** The seven days Monday-first, for drawing the week as the piece of road it was. Null = no record. */
  shape: (ColorTier | null)[]
  note: string | null
}

/** The Monday of the week that ended most recently — the one a summary can honestly be written about. */
export function lastCompleteWeekStart(today: string): string {
  return addDaysISO(weekStartOf(today), -7)
}

function weekSlice(sorted: Day[], start: string): Day[] {
  const end = addDaysISO(start, 6)
  return sorted.filter((d) => d.date >= start && d.date <= end)
}

function goldDaysIn(days: Day[]): number {
  return days.filter((d) => !isDayExcused(d) && d.colorTier === 'gold').length
}

/**
 * The week's summary, or null when the week holds no judged day at all — a week entirely of rest,
 * or one that ended before the history started. That case needs its own words, not a rate of zero.
 */
export function reviewWeek(days: Day[], weekStart: string): WeekReview | null {
  const sorted = sortedByDate(days)
  const week = weekSlice(sorted, weekStart)
  const judged = week.filter((d) => !isDayExcused(d))
  if (judged.length === 0) return null

  const byDate = new Map(week.map((d) => [d.date, d]))
  const shape = Array.from({ length: 7 }, (_, i) => byDate.get(addDaysISO(weekStart, i))?.colorTier ?? null)

  const prevWeek = weekSlice(sorted, addDaysISO(weekStart, -7))
  const prevJudged = prevWeek.filter((d) => !isDayExcused(d))
  const prevGoldDays = prevJudged.length === 0 ? null : goldDaysIn(prevWeek)

  const goldDays = goldDaysIn(week)
  const lastIndex = sorted.findIndex((d) => d.date === week[week.length - 1].date)

  return {
    start: weekStart,
    end: addDaysISO(weekStart, 6),
    goldDays,
    judgedDays: judged.length,
    restDays: week.length - judged.length,
    completionRate: judged.reduce((sum, d) => sum + d.completionRate, 0) / judged.length,
    prevGoldDays,
    goldStreakAtEnd: goldStreakEndingAt(sorted, lastIndex),
    shape,
    note: weekNote(goldDays, judged.length, prevGoldDays),
  }
}

/**
 * A comparison is printed only when the week before was judged too. «Больше, чем неделей раньше»
 * over a week that was entirely rest would be a comparison with nothing.
 */
function weekNote(goldDays: number, judgedDays: number, prevGoldDays: number | null): string | null {
  if (goldDays === judgedDays) return 'Неделя закрыта полностью.'
  if (prevGoldDays === null) return null
  if (goldDays > prevGoldDays) return `Золотых дней больше, чем неделей раньше: было ${prevGoldDays}.`
  if (goldDays < prevGoldDays) return `Золотых дней меньше, чем неделей раньше: было ${prevGoldDays}.`
  return 'Столько же золотых дней, сколько неделей раньше.'
}
