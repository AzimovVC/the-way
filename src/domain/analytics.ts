import { formatLongDate } from './calendar'
import type { Day, Goal } from './models'
import { isDayExcused, weekdayIndex } from './schedule'

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export interface SlumpRecoveryCycle {
  declineStart: string
  declineEnd: string
  declineLength: number
  recoveryEnd: string | null
  recoveryLength: number
}

interface Run {
  sign: 1 | -1 | 0
  start: number
  end: number
}

function signRuns(days: Day[]): Run[] {
  const runs: Run[] = []
  let i = 0
  while (i < days.length) {
    const sign = Math.sign(days[i].pathAngleDelta) as 1 | -1 | 0
    let j = i
    while (j < days.length && (Math.sign(days[j].pathAngleDelta) as 1 | -1 | 0) === sign) j++
    runs.push({ sign, start: i, end: j - 1 })
    i = j
  }
  return runs
}

/** Finds decline runs (negative smoothed angle) of at least minDeclineLength days, paired with the incline run that follows, if any. */
export function findSlumpRecoveryCycles(days: Day[], minDeclineLength = 3): SlumpRecoveryCycle[] {
  const sorted = sortedByDate(days)
  const runs = signRuns(sorted)
  const cycles: SlumpRecoveryCycle[] = []

  for (let k = 0; k < runs.length; k++) {
    const run = runs[k]
    if (run.sign !== -1) continue
    const declineLength = run.end - run.start + 1
    if (declineLength < minDeclineLength) continue

    const next = runs[k + 1]
    const isRecovery = next && next.sign === 1
    cycles.push({
      declineStart: sorted[run.start].date,
      declineEnd: sorted[run.end].date,
      declineLength,
      recoveryEnd: isRecovery ? sorted[next.end].date : null,
      recoveryLength: isRecovery ? next.end - next.start + 1 : 0,
    })
  }

  return cycles
}

/**
 * Marks where the daily set itself changed — a new goal, a task added, a task dropped.
 * Without these a stretch of the road is unreadable: a day counted out of two and a day
 * counted out of five look the same on the circle, and only the marker says the bar moved.
 */
function changeMarkerPatterns(days: Day[], goals: Goal[]): string[] {
  const titleById = new Map(goals.map((g) => [g.id, g.title]))
  const patterns: string[] = []
  for (const day of sortedByDate(days)) {
    for (const goalId of day.newGoalIds ?? []) {
      patterns.push(`${formatLongDate(day.date)}: на пути появилась новая цель — «${titleById.get(goalId) ?? 'новая цель'}».`)
    }
    const added = (day.taskChanges ?? []).filter((c) => c.kind === 'added')
    const removed = (day.taskChanges ?? []).filter((c) => c.kind === 'removed')
    if (added.length > 0) {
      patterns.push(`${formatLongDate(day.date)}: в день добавилась задача — ${added.map((c) => `«${c.title}»`).join(', ')}.`)
    }
    if (removed.length > 0) {
      patterns.push(`${formatLongDate(day.date)}: из дня ушла задача — ${removed.map((c) => `«${c.title}»`).join(', ')}.`)
    }
  }
  return patterns
}

/** Human-readable descriptions of the most significant decline/recovery cycles and changes to the daily set, most severe first. */
export function detectPatterns(days: Day[], goals: Goal[] = [], limit = 3): string[] {
  const cycles = [...findSlumpRecoveryCycles(days)].sort((a, b) => b.declineLength - a.declineLength)

  const cyclePatterns = cycles.slice(0, limit).map((c) =>
    c.recoveryLength > 0
      ? `Ты прошёл через спад и вернулся — ${c.declineLength} ${daysWord(c.declineLength)} падения, ${c.recoveryLength} ${daysWord(c.recoveryLength)} восстановления.`
      : `Спад длиной ${c.declineLength} ${daysWord(c.declineLength)} пока не завершился восстановлением.`,
  )

  return [...changeMarkerPatterns(days, goals), ...cyclePatterns]
}

export function daysWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня'
  return 'дней'
}

export interface StreakInfo {
  currentGoldStreak: number
  totalGoldDays: number
}

export function computeStreak(days: Day[]): StreakInfo {
  const sorted = sortedByDate(days)
  let currentGoldStreak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (isDayExcused(sorted[i])) continue
    if (sorted[i].colorTier !== 'gold') break
    currentGoldStreak++
  }
  const totalGoldDays = sorted.filter((d) => d.colorTier === 'gold').length
  return { currentGoldStreak, totalGoldDays }
}

export interface WeekdayStat {
  /** Monday-first index, matching WEEKDAY_LABELS and the schedule picker. */
  weekday: number
  avgCompletionRate: number
  sampleCount: number
}

/**
 * Average completion per weekday, Monday first. The index comes from weekdayIndex, the same
 * function the schedule uses: a person picks «Пн Ср Пт» in the task editor, and the bars for
 * those days have to stand in the same places, or the two screens are talking about
 * different weeks.
 *
 * Excused days are skipped rather than counted as zero — a planned day off is not a weak
 * Saturday, and averaging it in would invent a slump out of the schedule itself.
 */
export function computeWeekdayStats(days: Day[]): WeekdayStat[] {
  const buckets: { sum: number; count: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))

  for (const day of days) {
    if (isDayExcused(day)) continue
    const weekday = weekdayIndex(day.date)
    buckets[weekday].sum += day.completionRate
    buckets[weekday].count += 1
  }

  return buckets.map((bucket, weekday) => ({
    weekday,
    avgCompletionRate: bucket.count === 0 ? 0 : bucket.sum / bucket.count,
    sampleCount: bucket.count,
  }))
}

export interface GoalStat {
  goalId: string
  title: string
  overallAvg: number
  recentAvg: number
  trend: 'improving' | 'declining' | 'stable'
}

/** Per-goal completion trend: overall average vs. the last `recentWindow` days. */
export function computeGoalStats(goals: Goal[], days: Day[], recentWindow = 14): GoalStat[] {
  const sorted = sortedByDate(days)
  const recent = sorted.slice(-recentWindow)

  return goals
    .filter((g) => !g.archived)
    .map((goal) => {
      const templateIds = new Set(goal.tasks.map((t) => t.id))
      const overallAvg = averageGoalCompletion(sorted, templateIds)
      const recentAvg = averageGoalCompletion(recent, templateIds)
      const delta = recentAvg - overallAvg
      const trend: GoalStat['trend'] = delta > TREND_DELTA ? 'improving' : delta < -TREND_DELTA ? 'declining' : 'stable'
      return { goalId: goal.id, title: goal.title, overallAvg, recentAvg, trend }
    })
}

function averageGoalCompletion(days: Day[], templateIds: Set<string>): number {
  let sum = 0
  let count = 0
  for (const day of days) {
    const relevant = day.tasks.filter((t) => templateIds.has(t.taskTemplateId) && !t.skipped)
    if (relevant.length === 0) continue
    sum += relevant.filter((t) => t.isDone).length / relevant.length
    count++
  }
  return count === 0 ? 0 : sum / count
}

export interface Rebound {
  startDate: string
  endDate: string
  length: number
  slope: number // avg columnDriftX gained per day during the recovery
}

/** The steepest (fastest) and smoothest (most gradual, length >= 2) recoveries in the given days. */
export function findBestRebounds(days: Day[]): { steepest: Rebound | null; smoothest: Rebound | null } {
  const sorted = sortedByDate(days)
  const runs = signRuns(sorted).filter((r) => r.sign === 1)

  const rebounds: Rebound[] = runs.map((run) => {
    const length = run.end - run.start + 1
    const slope = (sorted[run.end].columnDriftX - sorted[run.start].columnDriftX) / length
    return { startDate: sorted[run.start].date, endDate: sorted[run.end].date, length, slope }
  })

  if (rebounds.length === 0) return { steepest: null, smoothest: null }

  const steepest = rebounds.reduce((a, b) => (b.slope > a.slope ? b : a))
  const multiDay = rebounds.filter((r) => r.length >= 2)
  const smoothest =
    multiDay.length > 0 ? multiDay.reduce((a, b) => (b.slope < a.slope ? b : a)) : null

  return { steepest, smoothest }
}

/**
 * A change smaller than this is noise: with a handful of days on each side of the split, one
 * ordinary day moves the average by more than a tenth, and a screen that calls that «растёт»
 * teaches the person to ignore it.
 */
const TREND_DELTA = 0.1

export interface PeriodSummary {
  /** Days the road actually judged — excused ones are not a result, good or bad. */
  askedDays: number
  goldDays: number
  restDays: number
  /** Mean completion over the asked days, 0..1. */
  completionRate: number
  currentGoldStreak: number
  /** The latest asked day that came out short, so the screen can say when the line broke. */
  lastMissDate: string | null
  trend: 'improving' | 'declining' | 'stable'
  /** Second half minus first half, in completion share — what the trend is based on. */
  delta: number
  /**
   * The two halves the trend is read from, so the screen can show them instead of asserting a
   * verdict out of nowhere. «Идёт ровно» over 82% and 91% reads as a blind app until you can see
   * that the gap is nine points and the word starts at ten.
   *
   * Zero when there is only one judged day and nothing to split.
   */
  earlyRate: number
  lateRate: number
  /**
   * Whether the period held two halves at all. Read this instead of testing the rates for zero:
   * a period genuinely made of missed days has both at zero and still has a witness to show,
   * and hiding it there leaves the bare verdict this pair exists to prevent.
   */
  hasHalves: boolean
}

/**
 * The one answer the statistics screen leads with. Everything below it explains this line, so it
 * is worth computing once and honestly: excused days are counted separately rather than folded
 * into the rate, and the trend compares the two halves of the period instead of the last day
 * against the average, which would swing on a single tap.
 *
 * Returns null when the period holds no judged day at all — a fresh start, or a stretch of rest.
 * That case needs its own words, not a rate of zero.
 *
 * `history` is the whole road, not the slice: «сейчас N дней подряд» is a fact about today, and
 * reading it from the period would cap the streak at the period's length and change the number
 * when the person taps another chip.
 */
export function summarizePeriod(days: Day[], history: Day[] = days): PeriodSummary | null {
  const sorted = sortedByDate(days)
  const asked = sorted.filter((d) => !isDayExcused(d))
  if (asked.length === 0) return null

  const mean = (arr: Day[]) => (arr.length === 0 ? 0 : arr.reduce((s, d) => s + d.completionRate, 0) / arr.length)
  const mid = Math.floor(asked.length / 2)
  const early = mean(asked.slice(0, mid))
  const late = mean(asked.slice(mid))
  const delta = mid === 0 ? 0 : late - early

  const lastMiss = [...asked].reverse().find((d) => d.completionRate < 1)

  return {
    askedDays: asked.length,
    goldDays: asked.filter((d) => d.colorTier === 'gold').length,
    restDays: sorted.length - asked.length,
    completionRate: mean(asked),
    currentGoldStreak: computeStreak(history).currentGoldStreak,
    lastMissDate: lastMiss?.date ?? null,
    trend: delta > TREND_DELTA ? 'improving' : delta < -TREND_DELTA ? 'declining' : 'stable',
    delta,
    earlyRate: mid === 0 ? 0 : early,
    lateRate: mid === 0 ? 0 : late,
    hasHalves: mid > 0,
  }
}
