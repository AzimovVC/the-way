import { GREEN_THRESHOLD } from './config'
import type { AppState, Day, DayTask, TaskTemplate } from './models'
import { addDaysISO, applyPathGeometry, getLogicalToday } from './pathEngine'

function activeTaskTemplates(state: AppState): TaskTemplate[] {
  return state.user.goals.filter((g) => !g.archived).flatMap((g) => g.tasks)
}

/** First `doneCount` templates (in order) are marked done — good enough for a fixed completion rate; order doesn't carry meaning. */
function buildDayTasks(templates: TaskTemplate[], dayId: string, doneCount: number, completedAt: string | null): DayTask[] {
  return templates.map((task, i) => ({
    id: crypto.randomUUID(),
    taskTemplateId: task.id,
    dayId,
    isDone: i < doneCount,
    skipped: false,
    completedAt: i < doneCount ? completedAt : null,
  }))
}

/**
 * Creates today's real Day (with a DayTask per active goal task) if it doesn't
 * exist yet. The gap-reconciliation effect only backfills empty gray days for
 * dates the app was never opened on — this is what turns "today" into an
 * actually actionable day once a new calendar day starts, the same way
 * onboarding builds day one.
 */
export function ensureTodayDay(state: AppState, now: Date = new Date()): AppState {
  const today = getLogicalToday(now)
  if (state.days.some((d) => d.date === today)) return state

  const templates = activeTaskTemplates(state)
  const newDay: Day = {
    id: today,
    date: today,
    tasks: buildDayTasks(templates, today, 0, null),
    completionRate: 0,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: 'red',
    frozen: false,
    newGoalIds: [],
  }

  return { ...state, days: [...state.days, newDay] }
}

/**
 * Dev-only: appends `count` fresh days after the last known date, each at the
 * completion rate `completionRateFor(dayIndex)` returns (0..1), so the path's
 * bend over a longer horizon can be previewed without waiting in real time.
 */
export function simulateFutureDays(
  state: AppState,
  count: number,
  completionRateFor: (dayIndex: number) => number,
): AppState {
  const templates = activeTaskTemplates(state)
  let lastDate = state.days.reduce(
    (max, d) => (d.date > max ? d.date : max),
    state.days[0]?.date ?? getLogicalToday(new Date()),
  )
  const newDays: Day[] = []

  for (let i = 0; i < count; i++) {
    lastDate = addDaysISO(lastDate, 1)
    const rate = Math.max(0, Math.min(1, completionRateFor(i)))
    const doneCount = Math.round(rate * templates.length)
    const completionRate = templates.length === 0 ? 0 : doneCount / templates.length
    newDays.push({
      id: lastDate,
      date: lastDate,
      tasks: buildDayTasks(templates, lastDate, doneCount, `${lastDate}T12:00:00.000Z`),
      completionRate,
      pathAngleDelta: 0,
      columnDriftX: 0,
      colorTier: completionRate >= 1 ? 'gold' : completionRate >= GREEN_THRESHOLD ? 'green' : 'red',
      frozen: false,
      newGoalIds: [],
    })
  }

  return { ...state, days: applyPathGeometry([...state.days, ...newDays]) }
}

/**
 * Dev-only: drops the most recent `count` days (never below zero left) so a
 * simulated run can be undone without a full reset, and re-derives path
 * geometry for what remains.
 */
export function removeLastDays(state: AppState, count: number): AppState {
  const sorted = [...state.days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const kept = sorted.slice(0, Math.max(0, sorted.length - count))
  return { ...state, days: applyPathGeometry(kept) }
}
