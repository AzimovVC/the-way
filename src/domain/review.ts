import { WEEK_REVIEW_MIN_COUNTED_DAYS } from './config'
import type { ColorTier, Day, DayTask } from './models'
import { addDaysISO } from './pathEngine'
import { isDayExcused, weekStartOf } from './schedule'

/**
 * The two moments the road stops and speaks: a day that just closed gold, and a week that just
 * ended. Everything here is a count over days that already exist — no new state is stored, and
 * nothing read here feeds back into geometry, colour or milestones.
 *
 * Only a **closed** day gets a screen. A day that came up short has no moment to be shown at: it
 * ends at 3:00 with nobody looking, and a screen that opened the next morning to say what was
 * missed tells the person nothing they do not already know — the road drew it last night.
 */

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * What the day actually asked of you. A skipped task is not part of the count anywhere else in
 * the domain — completionRate, the goal's progress, every reading of the clock — and a screen
 * that counted it would one day tell somebody who did two of three that they did three of three.
 */
function countableTasks(day: Day): DayTask[] {
  return day.tasks.filter((t: DayTask) => !t.skipped)
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
  /** Tasks the day asked for, skipped ones left out. All of them are done — that is the condition for this screen existing. */
  taskCount: number
  goldStreak: number
  /** True when no earlier stretch of this history was this long. */
  isStreakRecord: boolean
  goldDaysThisWeek: number
  /** Days of this week that count, so the week line is «4 из 5», not «4 из 7». */
  judgedDaysThisWeek: number
  /** Gold days over the whole road up to and including this one. */
  totalGoldDays: number
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
  const tasks = countableTasks(day)
  if (isDayExcused(day) || tasks.length === 0 || day.colorTier !== 'gold') return null

  const goldStreak = goldStreakEndingAt(sorted, index)
  const isStreakRecord = goldStreak > longestGoldStreak(sorted.slice(0, index))

  const weekStart = weekStartOf(day.date)
  const weekSoFar = sorted.filter((d) => d.date >= weekStart && d.date <= day.date)
  const judged = weekSoFar.filter((d) => !isDayExcused(d))
  const goldDaysThisWeek = judged.filter((d) => d.colorTier === 'gold').length
  const totalGoldDays = sorted.slice(0, index + 1).filter((d) => d.colorTier === 'gold').length

  return {
    date: day.date,
    taskCount: tasks.length,
    goldStreak,
    isStreakRecord,
    goldDaysThisWeek,
    judgedDaysThisWeek: judged.length,
    totalGoldDays,
    note: dayNote({ goldStreak, isStreakRecord, goldDaysThisWeek, judgedDaysThisWeek: judged.length, totalGoldDays }),
  }
}

/**
 * The first gold day is checked before everything else: on it the streak is 1 and it is a record,
 * and both of the lines those would produce are wrong. «Заново» needs something to go back to,
 * and nothing preceded this one.
 */
function dayNote(r: Omit<DayReview, 'date' | 'taskCount' | 'note'>): string | null {
  if (r.totalGoldDays === 1) return 'Первый золотой день на пути.'
  if (r.isStreakRecord && r.goldStreak > 1) return 'Такой длинной серии у тебя ещё не было.'
  if (r.goldStreak === 1) return 'Серия начинается заново.'
  if (r.judgedDaysThisWeek >= 3 && r.goldDaysThisWeek === r.judgedDaysThisWeek) {
    return 'Неделя пока идёт без единого пропуска.'
  }
  return null
}

export interface WeekReview {
  /** Monday and Sunday of the week, as date keys. */
  start: string
  end: string
  goldDays: number
  /** Days of the week that count — excused ones are counted apart, never folded in. */
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
 * The week's summary, or null when there is no week to speak of: no recorded days at all, or fewer
 * than `minCountedDays` of them in the count — a week entirely of rest, one that ended before the
 * history started, or the tail of a week somebody installed the app in the middle of.
 *
 * The floor defaults to WEEK_REVIEW_MIN_COUNTED_DAYS because the screen that arrives on its own
 * must not be a full-screen verdict on two days — the first thing a new user ever sees. It is an
 * argument rather than a constant because that reason belongs to the unbidden screen only: somebody
 * who taps a weekly badge on the road has asked about that week, and answering «nothing to say» to
 * a badge they can see is worse than answering thinly. That caller passes 0.
 */
export function reviewWeek(
  days: Day[],
  weekStart: string,
  { minCountedDays = WEEK_REVIEW_MIN_COUNTED_DAYS }: { minCountedDays?: number } = {},
): WeekReview | null {
  const sorted = sortedByDate(days)
  const week = weekSlice(sorted, weekStart)
  if (week.length === 0) return null
  const judged = week.filter((d) => !isDayExcused(d))
  if (judged.length < minCountedDays) return null

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
    completionRate: judged.length === 0 ? 0 : judged.reduce((sum, d) => sum + d.completionRate, 0) / judged.length,
    prevGoldDays,
    goldStreakAtEnd: goldStreakEndingAt(sorted, lastIndex),
    shape,
    note: weekNote(goldDays, prevGoldDays),
  }
}

/**
 * A comparison is printed only when the week before counted too. «Больше, чем неделей раньше»
 * over a week that was entirely rest would be a comparison with nothing.
 *
 * Nothing here says the week was closed in full: that is the screen's own heading, and saying it
 * twice on one screen is the app talking to itself. A full week still gets its comparison, which
 * is the line that heading cannot carry.
 */
function weekNote(goldDays: number, prevGoldDays: number | null): string | null {
  if (prevGoldDays === null) return null
  if (goldDays > prevGoldDays) return `Золотых дней больше, чем неделей раньше: было ${prevGoldDays}.`
  if (goldDays < prevGoldDays) return `Золотых дней меньше, чем неделей раньше: было ${prevGoldDays}.`
  return 'Столько же золотых дней, сколько неделей раньше.'
}
