import type { Day, Goal } from './models'

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
      patterns.push(`${day.date}: на пути появилась новая цель — «${titleById.get(goalId) ?? 'новая цель'}».`)
    }
    const added = (day.taskChanges ?? []).filter((c) => c.kind === 'added')
    const removed = (day.taskChanges ?? []).filter((c) => c.kind === 'removed')
    if (added.length > 0) {
      patterns.push(`${day.date}: в день добавилась задача — ${added.map((c) => `«${c.title}»`).join(', ')}.`)
    }
    if (removed.length > 0) {
      patterns.push(`${day.date}: из дня ушла задача — ${removed.map((c) => `«${c.title}»`).join(', ')}.`)
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

function daysWord(n: number): string {
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
    if (sorted[i].frozen) continue
    if (sorted[i].colorTier !== 'gold') break
    currentGoldStreak++
  }
  const totalGoldDays = sorted.filter((d) => d.colorTier === 'gold').length
  return { currentGoldStreak, totalGoldDays }
}

export interface WeekdayStat {
  weekday: number // 0 = Sunday, per Date#getUTCDay
  avgCompletionRate: number
  sampleCount: number
}

export function computeWeekdayStats(days: Day[]): WeekdayStat[] {
  const buckets: { sum: number; count: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))

  for (const day of days) {
    const [y, m, d] = day.date.split('-').map(Number)
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
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
      const trend: GoalStat['trend'] = delta > 0.1 ? 'improving' : delta < -0.1 ? 'declining' : 'stable'
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
