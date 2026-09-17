import { WEEK_INTERVAL_DAYS } from './config'
import type { Day, TaskTemplate } from './models'

const MS_PER_DAY = 86_400_000

/** A YYYY-MM-DD key split for Date.UTC — these are calendar dates, never instants. */
function dateParts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m - 1, d]
}

/** Monday-first, because that is how the week reads here and how the picker is drawn. */
export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/**
 * The same seven days spelled out, for the places a day is named inside a sentence rather than
 * used as a column head. «Крепче всего пн.» is a table cell that wandered into prose.
 */
export const WEEKDAY_FULL = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
]

export const EVERY_DAY: number[] = [0, 1, 2, 3, 4, 5, 6]

/**
 * Monday-first weekday index (0..6) of a YYYY-MM-DD date. Parsed as UTC on purpose: these
 * strings are calendar dates, not instants, and local parsing shifts them a day in negative
 * offsets — which would silently move someone's whole schedule.
 */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

/**
 * The Monday that opens the week a date falls in.
 *
 * Here rather than beside the callers because three of them wanted it — the week summary, the
 * clock's week-by-week drift, and the road's weekly badges — and three copies of the week's start
 * is exactly how one of them ends up counting from Sunday.
 */
export function weekStartOf(date: string): string {
  const ms = Date.UTC(...dateParts(date)) - weekdayIndex(date) * MS_PER_DAY
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * Where the n-th weekly mark on the road falls, counted in days elapsed since the history's first
 * day. Both places that lay weekly marks — the badges already on the road and the grey ones still
 * ahead of it — ask this, and neither does the arithmetic itself.
 *
 * The mark lands on a **Monday**, not seven days after whenever the person happened to start.
 * A week means Monday to Sunday everywhere else in the app (see weekdayIndex), and a badge on a
 * rolling seven-day grid would sit in the middle of a week and point back at seven days no summary
 * in the app counts together. On a Monday it stands on the very day the week's summary is shown.
 *
 * So the first mark comes sooner for somebody who started late in the week: begun on Saturday,
 * Н1 arrives in two days. That is the honest reading — the badge marks a week of the calendar
 * closing, not a personal seven-day anniversary. It is never day 0: at worst the person started on
 * a Monday, and then the mark is a full seven days out.
 */
export function weekMarkElapsed(firstDate: string, n: number): number {
  return n * WEEK_INTERVAL_DAYS - weekdayIndex(firstDate)
}

/** How many weekly marks the road has laid by elapsed day `elapsed` — so the next one is this plus one. */
export function weekMarksThrough(firstDate: string, elapsed: number): number {
  return Math.floor((elapsed + weekdayIndex(firstDate)) / WEEK_INTERVAL_DAYS)
}

/**
 * No weekdays stored means every day: the field is optional, and every task that existed before
 * schedules must keep behaving exactly as it did.
 */
export function isTaskScheduledOn(task: TaskTemplate, date: string): boolean {
  if (!task.weekdays || task.weekdays.length === 0) return true
  return task.weekdays.includes(weekdayIndex(date))
}

export function describeSchedule(weekdays?: number[]): string {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) return 'Каждый день'
  return [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(' ')
}

/**
 * A day the road must not hold against you. Two ways to earn it, and they mean different things
 * to the person — a freeze is spent, a rest day was planned — but geometry, streaks and
 * milestones treat them alike: the day passed, nothing was owed, nothing is charged.
 *
 * This is why it is one predicate and not a `frozen` check repeated in six places: a rest day
 * missed by any one of them would quietly count as a failure there.
 */
export function isDayExcused(day: Day): boolean {
  return day.frozen || day.rest === true
}

/**
 * What the task is asking for today. The tasks screen is the only list of tasks in the app, and a
 * bare «Пн Ср Пт» there states a rule without stating the state: the person still has to work out
 * whether today is one of those letters and whether they have already marked it.
 *
 * A day off is reported with the date it comes back, because «сегодня не спрашивают» on its own
 * reads as the task having quietly stopped.
 */
export type TaskToday =
  | { kind: 'done' }
  | { kind: 'pending' }
  | { kind: 'offDuty'; nextDate: string | null }

export function readTaskToday(task: TaskTemplate, today: Day | undefined, todayDate: string): TaskToday {
  const dayTask = today?.tasks.find((t) => t.taskTemplateId === task.id)
  if (dayTask) return dayTask.isDone ? { kind: 'done' } : { kind: 'pending' }
  // No entry today: either the day is a rest day, or the schedule skips it, or the day has not
  // been built yet. All three are the same answer to «что сегодня» — nothing is owed.
  return { kind: 'offDuty', nextDate: nextScheduledDate(task, todayDate) }
}

/**
 * The next date on or after the day *after* `from` that the task is scheduled for. Bounded by a
 * week: a weekday set is weekly, so if seven days turn up nothing there is nothing to find.
 */
export function nextScheduledDate(task: TaskTemplate, from: string): string | null {
  for (let i = 1; i <= 7; i += 1) {
    const date = shiftDate(from, i)
    if (isTaskScheduledOn(task, date)) return date
  }
  return null
}

/**
 * `pathEngine` has the same shift, but it imports this module: taking it from there would turn
 * the dependency around and put the path engine underneath the schedule. Parsed as UTC for the
 * reason `weekdayIndex` gives — these are calendar keys, and a local parse moves them a day.
 */
function shiftDate(date: string, days: number): string {
  const shifted = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
  return shifted.toISOString().slice(0, 10)
}

/**
 * The templates a given date actually asks for. Two filters, and both are the schedule's business:
 * the weekday set, and whether the habit existed yet.
 *
 * The second one only ever matters for a date in the past — a day being built for today cannot
 * predate any habit on it — and it matters there because a restored backup can carry habits that
 * started inside the stretch being rebuilt. Without it a Tuesday from before the habit existed
 * would be rebuilt owing it.
 */
export function templatesAskedOn(templates: TaskTemplate[], date: string): TaskTemplate[] {
  return templates.filter((task) => task.cycleStartDate <= date && isTaskScheduledOn(task, date))
}
