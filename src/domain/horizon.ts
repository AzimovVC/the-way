import { MILESTONE_LABEL } from './decorGeometry'
import { computeMilestoneProgress, TIER_LABEL } from './milestones'
import type { AppState, Day } from './models'
import { MILESTONE_THRESHOLD_DAYS, WEEK_INTERVAL_DAYS, type MilestoneKind } from './pathEngine'

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
  /**
   * Which badge the road will put down when it gets here, for the calendar marks that are one. The
   * horizon panel draws that very badge in grey, so what is listed as still ahead and what will
   * eventually stand on the road are visibly the same thing rather than two unrelated notations.
   */
  milestone?: MilestoneKind
  /** The weekly mark's occurrence number, since its badge says which week it is. */
  milestoneN?: number
  /**
   * How many *slots* past today the road will put this mark — days plus every chip it will lay on
   * the way, since a chip takes a slot of its own just as a day does.
   *
   * Not the same as `daysAhead`, and the difference is what lets the road draw a mark ahead in the
   * very slot its chip will occupy: the month mark three weeks out has three weekly chips laid
   * before it, so it lands three slots further along than the days alone would say. Only the
   * calendar marks have one — a tier is never laid on the road.
   */
  slotsAhead?: number
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

/**
 * Chips the road will lay between today and the mark at elapsed-day `threshold` — every weekly mark
 * still to come up to and including that day, plus any one-time mark strictly before it.
 *
 * Up to *and including*, because two marks can fall on the same day — 182 is 7 x 26 — and
 * computeMilestones lays the weekly one first, so from the half-year mark's point of view week 26
 * is a chip already in the ground. `self` takes the mark itself back out of that count.
 */
function chipsBefore(elapsed: number, threshold: number, self: 'week' | 'oneOff'): number {
  const firstWeek = Math.floor(elapsed / WEEK_INTERVAL_DAYS) + 1
  const lastWeek = Math.floor(threshold / WEEK_INTERVAL_DAYS)
  const weeks = Math.max(0, lastWeek - firstWeek + 1) - (self === 'week' ? 1 : 0)
  const oneOffs = Object.values(MILESTONE_THRESHOLD_DAYS).filter((t) => t > elapsed && t < threshold).length
  return weeks + oneOffs
}

function calendarMarkers(days: Day[]): HorizonMarker[] {
  const elapsed = elapsedDays(days)
  const markers: HorizonMarker[] = []

  // 'week' repeats, so only the next one is ever ahead of you in a useful sense — listing week 7,
  // 8, 9... would bury the one-off marks that actually mean something.
  const nextWeek = Math.floor(elapsed / WEEK_INTERVAL_DAYS) + 1
  const weekThreshold = nextWeek * WEEK_INTERVAL_DAYS
  markers.push({
    kind: 'calendar',
    label: `${MILESTONE_LABEL.week} ${nextWeek}`,
    daysAhead: weekThreshold - elapsed,
    milestone: 'week',
    milestoneN: nextWeek,
    slotsAhead: weekThreshold - elapsed + chipsBefore(elapsed, weekThreshold, 'week'),
  })

  for (const kind of Object.keys(MILESTONE_THRESHOLD_DAYS) as (keyof typeof MILESTONE_THRESHOLD_DAYS)[]) {
    const threshold = MILESTONE_THRESHOLD_DAYS[kind]
    const daysAhead = threshold - elapsed
    if (daysAhead > 0) {
      markers.push({
        kind: 'calendar',
        label: MILESTONE_LABEL[kind],
        daysAhead,
        milestone: kind,
        slotsAhead: daysAhead + chipsBefore(elapsed, threshold, 'oneOff'),
      })
    }
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
