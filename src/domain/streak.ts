import { dayWord } from './calendar'
import type { Day } from './models'
import { isDayExcused } from './schedule'

/**
 * The gold streak, read as stretches on the calendar rather than as one number.
 *
 * `computeStreak` in [analytics.ts](analytics.ts) answers «сколько сейчас» and nothing else, which
 * is all the chip in the header needs. The streak screen draws the stretch itself — where it
 * started, what it stepped over, how the longest one compares — and a screen that draws a shape
 * needs the shape, not its length.
 *
 * There is no ladder of streak steps here on purpose. Ranks are the one ladder in
 * [ranks.ts](ranks.ts) and they belong to a habit; a second set of rungs counting gold days would
 * be a second word for the same idea. The only mark the streak has is the longest one the person
 * has already walked — a target they set by living it.
 */
export interface StreakRun {
  /** First gold day of the stretch. Excused days before it belong to nobody. */
  startDate: string
  /** Last gold day. A run still going ends on the last gold day, not on today. */
  endDate: string
  /** Gold days only — the number the chip shows. */
  length: number
  /**
   * Days inside the stretch that asked nothing — a rest day or a spent freeze. They neither add to
   * the length nor end the run, and the calendar draws the line straight through them: that is the
   * whole rule made visible, in the one place a person looks for it.
   */
  bridgedDates: string[]
  /** True when nothing after this run has ended it yet — the streak the person is standing in. */
  current: boolean
}

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * Every gold stretch in the history, oldest first.
 *
 * Excused days are held aside rather than joined immediately: a rest day after the last gold day
 * of a run is not part of it, and taking it in would draw a line reaching past where the streak
 * actually got to. Only when another gold day follows does the gap become a bridge.
 */
export function streakRuns(days: Day[]): StreakRun[] {
  const sorted = sortedByDate(days)
  const runs: StreakRun[] = []

  let golds: string[] = []
  let pending: string[] = []
  let bridged: string[] = []

  const close = (current: boolean) => {
    if (golds.length > 0) {
      runs.push({
        startDate: golds[0],
        endDate: golds[golds.length - 1],
        length: golds.length,
        bridgedDates: bridged,
        current,
      })
    }
    golds = []
    pending = []
    bridged = []
  }

  for (const day of sorted) {
    if (isDayExcused(day)) {
      if (golds.length > 0) pending.push(day.date)
      continue
    }
    if (day.colorTier === 'gold') {
      bridged = [...bridged, ...pending]
      pending = []
      golds.push(day.date)
      continue
    }
    close(false)
  }
  close(true)

  return runs
}

export interface StreakOverview {
  /** Gold days in the streak being stood in, 0 when the last counted day was not gold. */
  current: number
  /** The longest stretch ever walked — the only target the streak has. */
  best: number
  /** Where the current streak started, for «с 11 сентября». Null when there is no current streak. */
  currentStartDate: string | null
  totalGoldDays: number
  runs: StreakRun[]
}

export function streakOverview(days: Day[]): StreakOverview {
  const runs = streakRuns(days)
  const live = runs.find((run) => run.current)
  return {
    current: live?.length ?? 0,
    best: runs.reduce((max, run) => Math.max(max, run.length), 0),
    currentStartDate: live?.startDate ?? null,
    totalGoldDays: runs.reduce((sum, run) => sum + run.length, 0),
    runs,
  }
}

/**
 * How a single date takes part in a streak — what the calendar needs to draw the line under a week.
 *
 * `start` and `end` are the ends of the stretch itself, not of the calendar row: a run crossing
 * Sunday is one run, and the grid decides on its own where to round the corners.
 */
export interface StreakMark {
  kind: 'gold' | 'bridged'
  start: boolean
  end: boolean
}

export function streakIndex(runs: StreakRun[]): Map<string, StreakMark> {
  const index = new Map<string, StreakMark>()
  for (const run of runs) {
    // A run of one gold day is both ends of itself, and the calendar draws it as a lone circle.
    const bridges = new Set(run.bridgedDates)
    for (const date of spanDates(run)) {
      index.set(date, {
        kind: bridges.has(date) ? 'bridged' : 'gold',
        start: date === run.startDate,
        end: date === run.endDate,
      })
    }
  }
  return index
}

/** Every date from the run's first gold day to its last, bridges included. */
function spanDates(run: StreakRun): string[] {
  const dates: string[] = []
  for (let t = Date.parse(`${run.startDate}T00:00:00Z`); t <= Date.parse(`${run.endDate}T00:00:00Z`); t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10))
  }
  return dates
}

/**
 * The one line above the calendar — a fact about the streak, never a verdict about the person.
 *
 * Counts only. The clock findings in [timeOfDay.ts](timeOfDay.ts) are correlations and carry a
 * caveat that has to be read beside the number; a banner is one line with no room for it, and a
 * correlation with its caveat cut off is the app claiming a cause it never measured.
 */
export function streakHighlight(overview: StreakOverview): string {
  if (overview.totalGoldDays === 0) return 'Серия начнётся с первого дня, закрытого полностью.'
  if (overview.current === 0) {
    return `Самая длинная серия — ${overview.best} ${dayWord(overview.best)}.`
  }
  if (overview.current >= overview.best) return 'Это самая длинная серия за всё время.'
  const left = overview.best - overview.current
  return `До самой длинной серии — ${left} ${dayWord(left)}.`
}
