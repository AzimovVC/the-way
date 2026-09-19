import { DEFAULT_FREEZES_REMAINING } from '../domain/config'
import type { AppState, Day, DayTask, Goal, TaskTemplate } from '../domain/models'
import { addDaysISO, applyPathGeometry, getLogicalToday } from '../domain/pathEngine'
import { isTaskScheduledOn } from '../domain/schedule'

// Six weeks rather than four: the time-of-day statistics need TIME_MIN_MARKS marks per task, and
// a task asked for three days a week only reaches that in the fifth.
const HISTORY_DAYS = 42

/**
 * Dev-only: a history that already contains every kind of day worth looking at, so testing does
 * not start with four weeks of tapping.
 *
 * Two goals on different schedules is what makes it useful. Weekends are off for both, so rest
 * days actually occur; Mon/Wed/Fri ask for two tasks and Tue/Thu for one, so a full working day
 * and a half-empty one sit side by side. The slump in the third week bends the road down and
 * back up again, which is the only way to see the geometry do its job.
 */
export function buildTestHistory(now: Date = new Date()): AppState {
  const today = getLogicalToday(now)
  const start = addDaysISO(today, -(HISTORY_DAYS - 1))

  const run: TaskTemplate = {
    id: 'seed-task-run',
    goalId: 'seed-goal-run',
    title: 'Пробежка',
    weekdays: [0, 2, 4],
    cycleStartDate: start,
  }

  const read: TaskTemplate = {
    id: 'seed-task-read',
    goalId: 'seed-goal-read',
    title: 'Читать',
    weekdays: [0, 1, 2, 3, 4],
    cycleStartDate: start,
  }

  const goals: Goal[] = [
    { id: 'seed-goal-run', title: 'Пробежка', tasks: [run], archived: false },
    { id: 'seed-goal-read', title: 'Читать', tasks: [read], archived: false },
  ]

  /**
   * How much of day `i` got done. A clean start, a slump in the third week, a recovery, and
   * today left untouched so there is something to actually tap on opening the app.
   */
  function rateFor(i: number): number {
    if (i === HISTORY_DAYS - 1) return 0
    if (i >= 14 && i <= 18) return i % 2 === 0 ? 0 : 0.5
    if (i === 5 || i === 9) return 0.5
    return 1
  }

  /**
   * Dev-only: plausible marking times, so the time-of-day statistics have something to read.
   * The run drifts later week by week (that is the early-warning signal worth seeing on screen),
   * the reading sits in the evening, and both wobble by a deterministic few dozen minutes so the
   * habit window has a width instead of being a single line.
   */
  function markTime(taskId: string, i: number): string {
    const jitter = (((i * 2654435761 + taskId.length * 40503) >>> 0) % 60) / 60 - 0.5
    const hour = taskId === run.id ? 7.2 + i * 0.12 + jitter * 0.8 : 20 + jitter * 2
    const h = Math.floor(hour)
    return `${String(h).padStart(2, '0')}:${String(Math.round((hour - h) * 60)).padStart(2, '0')}`
  }

  const days: Day[] = []
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const date = addDaysISO(start, i)
    const scheduled = [run, read].filter((task) => isTaskScheduledOn(task, date))
    const doneCount = Math.round(rateFor(i) * scheduled.length)

    const tasks: DayTask[] = scheduled.map((task, n) => {
      const local = markTime(task.id, i)
      return {
        taskTemplateId: task.id,
        dayId: date,
        isDone: n < doneCount,
        skipped: false,
        // The two agree by construction here; a real mark writes the local clock separately
        // because the browser's zone at read time is not the zone the mark was made in.
        completedAt: n < doneCount ? `${date}T${local}:00.000Z` : null,
        completedLocal: n < doneCount ? local : undefined,
      }
    })

    days.push({
      id: date,
      date,
      tasks,
      completionRate: tasks.length === 0 ? 0 : doneCount / tasks.length,
      pathAngleDelta: 0,
      columnDriftX: 0,
      // applyPathGeometry re-derives this — but it deliberately leaves grey days grey, since grey
      // means "nothing was ever recorded here". Seeding grey would paint the whole history as
      // days the app was never opened on.
      colorTier: tasks.length === 0 ? 'rest' : 'red',
      frozen: false,
      rest: tasks.length === 0,
      newGoalIds: [],
      taskChanges: [],
    })
  }

  return {
    user: {
      id: 'seed-user',
      name: 'Тестер',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notificationsEnabled: true,
      freezesRemaining: DEFAULT_FREEZES_REMAINING,
      freezesRefilledMonth: today.slice(0, 7),
      goals,
    },
    days: applyPathGeometry(days),
  }
}
