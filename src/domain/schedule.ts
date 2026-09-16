import type { Day, TaskTemplate } from './models'

/** Monday-first, because that is how the week reads here and how the picker is drawn. */
export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

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
 * No weekdays stored means every day: the field is optional, and every task that existed before
 * schedules must keep behaving exactly as it did.
 */
export function isTaskScheduledOn(task: TaskTemplate, date: string): boolean {
  if (!task.weekdays || task.weekdays.length === 0) return true
  return task.weekdays.includes(weekdayIndex(date))
}

/** How many times a week the task is asked for — what a milestone horizon has to be read against. */
export function scheduledDaysPerWeek(task: TaskTemplate): number {
  return !task.weekdays || task.weekdays.length === 0 ? 7 : task.weekdays.length
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
