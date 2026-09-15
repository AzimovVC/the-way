import { MILESTONE_LABEL } from './decorGeometry'
import { computeMilestoneProgress, TIER_LABEL } from './milestones'
import type { AppState, Day } from './models'
import { MILESTONE_THRESHOLD_DAYS, WEEK_INTERVAL_DAYS } from './pathEngine'

/**
 * Something the road is heading toward, and how far off it is.
 *
 * `daysAhead` is always counted in days the user still has to *put in*, never in calendar dates.
 * For a calendar mark the two coincide; for a habit tier they only coincide on a road of kept days —
 * which is exactly what the ghost road past today is, so a marker placed on it lands honestly.
 * Miss a day and a tier marker moves further off (a miss costs MILESTONE_ROLLBACK_MULTIPLIER of
 * progress), which is the whole point: the cost of skipping shows up as the goal receding, with
 * nothing scolding anybody.
 */
export interface HorizonMarker {
  kind: 'calendar' | 'tier'
  label: string
  daysAhead: number
}

const MS_PER_DAY = 86_400_000

function toUTCms(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Whole days between the first recorded day and the last one — the same elapsed count computeMilestones places its chips by. */
function elapsedDays(days: Day[]): number {
  const first = toUTCms(days[0].date)
  const last = toUTCms(days[days.length - 1].date)
  return Math.round((last - first) / MS_PER_DAY)
}

function calendarMarkers(days: Day[]): HorizonMarker[] {
  const elapsed = elapsedDays(days)
  const markers: HorizonMarker[] = []

  // 'week' repeats, so only the next one is ever ahead of you in a useful sense — listing week 7,
  // 8, 9... would bury the one-off marks that actually mean something.
  const nextWeek = Math.floor(elapsed / WEEK_INTERVAL_DAYS) + 1
  markers.push({
    kind: 'calendar',
    label: `${MILESTONE_LABEL.week} ${nextWeek}`,
    daysAhead: nextWeek * WEEK_INTERVAL_DAYS - elapsed,
  })

  for (const kind of Object.keys(MILESTONE_THRESHOLD_DAYS) as (keyof typeof MILESTONE_THRESHOLD_DAYS)[]) {
    const daysAhead = MILESTONE_THRESHOLD_DAYS[kind] - elapsed
    if (daysAhead > 0) markers.push({ kind: 'calendar', label: MILESTONE_LABEL[kind], daysAhead })
  }

  return markers
}

function tierMarkers(state: AppState): HorizonMarker[] {
  const markers: HorizonMarker[] = []
  for (const goal of state.user.goals) {
    if (goal.archived) continue
    for (const task of goal.tasks) {
      const progress = computeMilestoneProgress(task, state.days)
      if (!progress.nextTier || progress.nextTierTarget === null) continue
      const daysAhead = Math.ceil(progress.nextTierTarget - progress.progressDays)
      if (daysAhead <= 0) continue
      markers.push({ kind: 'tier', label: `${task.title} · ${TIER_LABEL[progress.nextTier]}`, daysAhead })
    }
  }
  return markers
}

/**
 * Everything the road is currently heading toward, nearest first.
 *
 * Deliberately not filtered by the horizon: the caller decides what to draw on the road and what to
 * list at its edge, so a goal that is still months out is never simply invisible.
 */
export function upcomingMarkers(state: AppState): HorizonMarker[] {
  if (state.days.length === 0) return []
  return [...calendarMarkers(state.days), ...tierMarkers(state)].sort((a, b) => a.daysAhead - b.daysAhead)
}
