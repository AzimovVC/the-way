import {
  BATCH_MARK_MIN_DAYS,
  BATCH_MARK_SHARE,
  BATCH_MARK_WINDOW_MIN,
  DAY_BOUNDARY_HOUR,
  EARLY_LATE_MIN_DAYS,
  POINT_OF_NO_RETURN_CHANCE,
  POINT_OF_NO_RETURN_MIN_OPEN,
  TIME_MIN_MARKS,
} from './config'
import type { Day, DayTask } from './models'
import { addDaysISO } from './pathEngine'
import { isDayExcused, weekdayIndex } from './schedule'

/**
 * When a mark landed, on a 3..27 scale rather than 0..23.
 *
 * The logical day closes at DAY_BOUNDARY_HOUR, so a mark made at 00:40 belongs to the day that
 * is ending: it is that day's latest moment, not its earliest. Read as a plain clock hour it
 * would be 0 — the earliest possible — and every statistic here would have it backwards.
 *
 * `completedLocal` is preferred where it exists because it is the clock the person actually
 * looked at. The ISO timestamp is read in the browser's current zone, which is not necessarily
 * the zone the mark was made in.
 */
export function logicalHourOf(task: Pick<DayTask, 'completedAt' | 'completedLocal'>): number | null {
  if (task.completedLocal) {
    const [h, m] = task.completedLocal.split(':').map(Number)
    if (Number.isFinite(h) && Number.isFinite(m)) return shiftIntoLogicalDay(h + m / 60)
  }
  if (!task.completedAt) return null
  const at = new Date(task.completedAt)
  if (Number.isNaN(at.getTime())) return null
  return shiftIntoLogicalDay(at.getHours() + at.getMinutes() / 60)
}

function shiftIntoLogicalDay(hour: number): number {
  return hour < DAY_BOUNDARY_HOUR ? hour + 24 : hour
}

/**
 * Sorts a day's completed tasks into the order they were marked.
 *
 * Ordering runs off the ISO timestamp where the whole day has one, because it keeps seconds while
 * completedLocal keeps only minutes — and the person most likely to lose the order is exactly the
 * one who marks everything at once, inside a single minute. Falling back to the clock reading is
 * only for days recorded before timestamps, and never mixed with the other scale within a day.
 */
function orderOfMarks(tasks: DayTask[]): Map<string, number> {
  const done = tasks.filter((t) => t.isDone)
  const instants = done.map((t) => (t.completedAt ? Date.parse(t.completedAt) : Number.NaN))
  const precise = instants.every((v) => !Number.isNaN(v))

  const keyed = done
    .map((task, i) => ({ id: task.id, key: precise ? instants[i] : logicalHourOf(task) }))
    .filter((e): e is { id: string; key: number } => e.key !== null)
    .sort((a, b) => a.key - b.key)

  return new Map(keyed.map((e, i) => [e.id, i + 1]))
}

/** The task a day started with, by mark order. */
function firstTaskIdOf(day: Day): string | null {
  const asked = day.tasks.filter((t) => !t.skipped)
  const order = orderOfMarks(asked)
  for (const task of asked) if (order.get(task.id) === 1) return task.taskTemplateId
  return null
}

/** One task on one day it was actually asked for. Everything below is read off these. */
export interface Mark {
  date: string
  taskId: string
  done: boolean
  /** Logical hour of the mark, or null when the task was not done (or was done before times were kept). */
  hour: number | null
  /** 1-based position among that day's timed marks; null when this one has no time. */
  order: number | null
  /** How many tasks the day asked for — the statistics that compare a task against the rest of its day need it. */
  askedThatDay: number
}

/**
 * Flattens history into one row per task per day it was asked for.
 *
 * Excused days are left out entirely, and that is not a detail: a rest day or a frozen day is
 * the app saying nothing was owed. Counting one as a day the task went undone would put a
 * planned day off into the evidence for "you have given up by this hour".
 */
export function buildMarks(days: Day[]): Mark[] {
  const marks: Mark[] = []

  for (const day of days) {
    if (isDayExcused(day)) continue
    const asked = day.tasks.filter((t) => !t.skipped)
    if (asked.length === 0) continue

    const orderById = orderOfMarks(asked)

    for (const task of asked) {
      marks.push({
        date: day.date,
        taskId: task.taskTemplateId,
        done: task.isDone,
        hour: task.isDone ? logicalHourOf(task) : null,
        order: orderById.get(task.id) ?? null,
        askedThatDay: asked.length,
      })
    }
  }

  return marks
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * q
  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower)
}

// --- 4. The habit window ---------------------------------------------------

export interface HabitWindow {
  /** Logical hours. */
  median: number
  low: number
  high: number
  markCount: number
}

/**
 * When this task usually happens. Median and quartiles rather than an average: one mark left
 * until midnight drags a mean by an hour and tells the person their morning habit is an evening
 * one.
 */
export function habitWindow(marks: Mark[], taskId: string): HabitWindow | null {
  const hours = marks
    .filter((m) => m.taskId === taskId && m.hour !== null)
    .map((m) => m.hour as number)
    .sort((a, b) => a - b)
  if (hours.length < TIME_MIN_MARKS) return null

  return {
    median: quantile(hours, 0.5),
    low: quantile(hours, 0.25),
    high: quantile(hours, 0.75),
    markCount: hours.length,
  }
}

// --- 3. Drift --------------------------------------------------------------

export interface DriftWeek {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string
  median: number
  markCount: number
}

export interface TimeDrift {
  weeks: DriftWeek[]
  /** Hours later per week, by least squares. Negative means the task is creeping earlier. */
  hoursPerWeek: number
}

function weekStartOf(date: string): string {
  return addDaysISO(date, -weekdayIndex(date))
}

/**
 * Whether the task is sliding later week by week. A habit rarely stops outright — it drifts
 * first, and the drift shows up a week or two before the road starts bending down. That is the
 * whole reason this one exists: it is the only early signal in the app.
 */
export function timeDrift(marks: Mark[], taskId: string, minWeeks = 3): TimeDrift | null {
  const byWeek = new Map<string, number[]>()
  for (const mark of marks) {
    if (mark.taskId !== taskId || mark.hour === null) continue
    const key = weekStartOf(mark.date)
    const bucket = byWeek.get(key)
    if (bucket) bucket.push(mark.hour)
    else byWeek.set(key, [mark.hour])
  }

  // A week represented by a single mark is a point, not a week: its "median" is that one mark.
  const weeks: DriftWeek[] = [...byWeek.entries()]
    .filter(([, hours]) => hours.length >= 2)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekStart, hours]) => ({
      weekStart,
      median: quantile([...hours].sort((a, b) => a - b), 0.5),
      markCount: hours.length,
    }))

  if (weeks.length < minWeeks) return null

  // Regressed against the real week number, not the position in the list, so a week with no
  // marks counts as a gap rather than collapsing the timeline.
  const firstWeek = weeks[0].weekStart
  const xs = weeks.map((w) => Math.round(daysBetween(firstWeek, w.weekStart) / 7))
  const ys = weeks.map((w) => w.median)
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }

  return { weeks, hoursPerWeek: den === 0 ? 0 : num / den }
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

// --- 1. The point of no return ---------------------------------------------

export interface PointOfNoReturn {
  /** Logical hour, whole. */
  hour: number
  /** Share of days still open at that hour that ended up done anyway. */
  chance: number
  /** Days the estimate stands on. */
  openDays: number
}

/**
 * The hour after which this task stops happening. Read as survival: of the days where it was
 * still not done by hour H, how many landed later anyway. The first hour where that falls below
 * POINT_OF_NO_RETURN_CHANCE is the point.
 *
 * Returns null when there is nothing to find — and one of those cases is worth saying out loud:
 * someone who almost never misses runs out of open days before the chance ever drops, which is
 * not a gap in the data but an answer. They have no point of no return.
 */
export function pointOfNoReturn(marks: Mark[], taskId: string): PointOfNoReturn | null {
  const rows = marks.filter((m) => m.taskId === taskId)
  if (rows.length < TIME_MIN_MARKS) return null

  for (let hour = DAY_BOUNDARY_HOUR + 1; hour <= DAY_BOUNDARY_HOUR + 24; hour++) {
    // Done before this hour is settled either way; what is left is the days still in play.
    const open = rows.filter((m) => m.hour === null || m.hour > hour)
    if (open.length < POINT_OF_NO_RETURN_MIN_OPEN) return null

    const chance = open.filter((m) => m.done).length / open.length
    if (chance < POINT_OF_NO_RETURN_CHANCE) return { hour, chance, openDays: open.length }
  }

  return null
}

// --- 2. Starting early and how the day ended -------------------------------

/**
 * Share of the day's *other* tasks that got done. Excluding the one that came first is what
 * keeps this honest: a day counts its first task too, so "started early → day went well" would
 * be partly true by construction, on every single-task day entirely so.
 */
function restRate(day: Day, exceptTaskId: string | null): number | null {
  const rest = day.tasks.filter((t) => !t.skipped && t.taskTemplateId !== exceptTaskId)
  if (rest.length === 0) return null
  return rest.filter((t) => t.isDone).length / rest.length
}

export interface EarlyStartLink {
  /** Logical hour the days were split at — the person's own median start, not a fixed morning. */
  splitHour: number
  earlyRestRate: number
  lateRestRate: number
  earlyDays: number
  lateDays: number
}

/**
 * How the rest of the day went depending on when the first task landed. Split at the person's
 * own median rather than at a fixed hour: "before noon" means nothing to someone who works nights.
 *
 * This is a correlation and has to be worded as one. Early days may simply be the days that were
 * already going to be good.
 */
export function earlyStartLink(days: Day[]): EarlyStartLink | null {
  const rows: { hour: number; rest: number }[] = []

  for (const day of days) {
    if (isDayExcused(day)) continue
    const asked = day.tasks.filter((t) => !t.skipped)
    if (asked.length < 2) continue

    const firstTaskId = firstTaskIdOf(day)
    if (firstTaskId === null) continue
    const firstHour = logicalHourOf(asked.find((t) => t.taskTemplateId === firstTaskId)!)
    if (firstHour === null) continue

    const rest = restRate(day, firstTaskId)
    if (rest !== null) rows.push({ hour: firstHour, rest })
  }

  if (rows.length < EARLY_LATE_MIN_DAYS * 2) return null

  const splitHour = quantile(rows.map((r) => r.hour).sort((a, b) => a - b), 0.5)
  const early = rows.filter((r) => r.hour < splitHour)
  const late = rows.filter((r) => r.hour >= splitHour)
  if (early.length < EARLY_LATE_MIN_DAYS || late.length < EARLY_LATE_MIN_DAYS) return null

  const mean = (xs: { rest: number }[]) => xs.reduce((sum, x) => sum + x.rest, 0) / xs.length
  return {
    splitHour,
    earlyRestRate: mean(early),
    lateRestRate: mean(late),
    earlyDays: early.length,
    lateDays: late.length,
  }
}

// --- 5. The anchor task ----------------------------------------------------

export interface AnchorTask {
  taskId: string
  /** How often this task goes first on the days it shares with others. */
  firstShare: number
  restRateWhenDone: number
  restRateWhenNot: number
  daysDone: number
  daysNotDone: number
}

/**
 * The task the day tends to start with, and what the rest of the day does depending on whether
 * it happened. Same guard as above: the anchor is excluded from the rate it is measured against,
 * or "did the anchor → day went well" would be arithmetic rather than a finding.
 */
export function anchorTask(days: Day[]): AnchorTask | null {
  const shared = days.filter((d) => !isDayExcused(d) && d.tasks.filter((t) => !t.skipped).length >= 2)
  if (shared.length < EARLY_LATE_MIN_DAYS) return null

  const firstCount = new Map<string, number>()
  const askedCount = new Map<string, number>()

  for (const day of shared) {
    const asked = day.tasks.filter((t) => !t.skipped)
    for (const task of asked) {
      askedCount.set(task.taskTemplateId, (askedCount.get(task.taskTemplateId) ?? 0) + 1)
    }

    const firstTaskId = firstTaskIdOf(day)
    if (firstTaskId !== null) firstCount.set(firstTaskId, (firstCount.get(firstTaskId) ?? 0) + 1)
  }

  let taskId: string | null = null
  let best = 0
  for (const [id, count] of firstCount) {
    if (count > best) {
      best = count
      taskId = id
    }
  }
  if (taskId === null) return null

  const done: number[] = []
  const not: number[] = []
  for (const day of shared) {
    const anchor = day.tasks.find((t) => !t.skipped && t.taskTemplateId === taskId)
    if (!anchor) continue
    const rest = restRate(day, taskId)
    if (rest === null) continue
    ;(anchor.isDone ? done : not).push(rest)
  }

  // Nothing to compare against: the anchor either always happens or never does.
  if (done.length === 0 || not.length === 0) return null

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return {
    taskId,
    firstShare: best / (askedCount.get(taskId) ?? best),
    restRateWhenDone: mean(done),
    restRateWhenNot: mean(not),
    daysDone: done.length,
    daysNotDone: not.length,
  }
}

// --- How the marks were made ----------------------------------------------

export interface MarkingStyle {
  /** True when most multi-mark days were filled in at one sitting. */
  batched: boolean
  batchedDays: number
  multiMarkDays: number
}

/**
 * Whether the timestamps describe when the person acts or when they fill the app in.
 *
 * Nothing is hidden on the strength of this — it decides a label, not access. Someone who marks
 * everything at once still gets every statistic that depends on order rather than on the clock;
 * what changes is that the hour is called "when you mark" instead of "when you do it", which is
 * the true reading of their own data.
 */
export function markingStyle(days: Day[]): MarkingStyle {
  let multiMarkDays = 0
  let batchedDays = 0

  for (const day of days) {
    if (isDayExcused(day)) continue
    const hours = day.tasks
      .filter((t) => !t.skipped && t.isDone)
      .map((t) => logicalHourOf(t))
      .filter((h): h is number => h !== null)
    if (hours.length < 2) continue

    multiMarkDays++
    const spanMinutes = (Math.max(...hours) - Math.min(...hours)) * 60
    if (spanMinutes <= BATCH_MARK_WINDOW_MIN) batchedDays++
  }

  return {
    batched: multiMarkDays >= BATCH_MARK_MIN_DAYS && batchedDays / multiMarkDays >= BATCH_MARK_SHARE,
    batchedDays,
    multiMarkDays,
  }
}
