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
