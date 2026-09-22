import { MILESTONE_LABEL } from './decorGeometry'
import { computeMilestoneProgress } from './milestones'
import { rankLabel } from './ranks'
import type { AppState, Day } from './models'
import { addDaysISO } from './pathEngine'
import { MILESTONE_THRESHOLD_DAYS, type MilestoneKind } from './pathEngine'
import { monthMarkElapsed, monthMarksThrough, weekMarkElapsed, weekMarksThrough } from './schedule'

/**
 * Something the road is heading toward, and how far off it is.
 *
 * `daysAhead` is always counted in days the user still has to *put in*, never in calendar dates.
 * For a calendar mark the two coincide; for a habit tier they only coincide on a road of kept days —
 * which is exactly what the ghost road past today is, so a marker placed on it lands honestly.
 * Let a gap open and a tier marker moves further off (see MILESTONE_MISS_COST_BY_STREAK), which is
 * the whole point: the cost of stopping shows up as the goal receding, with nothing scolding
 * anybody. Coming back pulls it in again, faster than it receded.
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
  /** The repeating mark's occurrence number, since the week's badge says which week it is. */
  milestoneN?: number
  /**
   * The day the mark will fall on. The month's badge is named for its own month — «ОКТ» — so the
   * grey badge listed here cannot be drawn without it, and deriving it twice is how the badge ahead
   * and the badge that finally stands there come to disagree.
   */
  milestoneDate?: string
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
  /**
   * Whose tier this is — the task's own key, on tier markers only.
   *
   * Here because `label` is not a name: it is a sentence built out of a title the person wrote
   * («Турник · Новичок»), and two habits called the same thing, or one habit living under two
   * goals, produce the same sentence twice. React was keying its rows by that sentence and quietly
   * dropping one of the twins — a marker that vanished from the horizon with nothing to show for
   * it. See `markerKey`.
   */
  taskId?: string
}

/**
 * How to tell two markers apart.
 *
 * A tier is told apart by the task it belongs to; everything else by its label, which for the
 * calendar marks really is unique — one week ahead, one month, one of each one-off kind. The
 * distinction lives here rather than at the two call sites so it cannot be made twice and
 * differently: the road and the horizon panel draw the same list.
 */
export function markerKey(marker: HorizonMarker): string {
  return marker.taskId ?? marker.label
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
 * The order computeMilestones lays chips in when more than one falls on the same day: week, then
 * month, then the one-time marks. Written here as a number because that is the only thing this file
 * needs from it — whether a same-day neighbour is already in the ground when this mark arrives.
 */
const CHIP_ORDER = { week: 0, month: 1, oneOff: 2 } as const
type ChipOrder = keyof typeof CHIP_ORDER

/**
 * Chips the road will lay between today and the mark at elapsed-day `threshold`.
 *
 * Two marks really can share a day — a 1st that is also a Monday, or 182, which is 7 x 26 — so this
 * cannot simply count days. A same-day neighbour is in the ground already if it is laid *earlier*
 * in CHIP_ORDER, and still to come if later; `self` says where the mark asking sits in that order,
 * which is what takes it out of its own count.
 */
function repeatingBefore(
  firstDate: string,
  from: number,
  threshold: number,
  self: ChipOrder,
  kind: 'week' | 'month',
): number {
  const through = kind === 'week' ? weekMarksThrough : monthMarksThrough
  const markElapsed = kind === 'week' ? weekMarkElapsed : monthMarkElapsed
  const inRange = through(firstDate, threshold) - through(firstDate, from)
  // A mark of this kind landing exactly on the threshold counts only when this kind is laid first.
  const onTheDay = markElapsed(firstDate, through(firstDate, threshold)) === threshold ? 1 : 0
  return inRange - (CHIP_ORDER[self] <= CHIP_ORDER[kind] ? onTheDay : 0)
}

function chipsBefore(firstDate: string, elapsed: number, threshold: number, self: ChipOrder): number {
  const weeks = repeatingBefore(firstDate, elapsed, threshold, self, 'week')
  const months = repeatingBefore(firstDate, elapsed, threshold, self, 'month')
  const oneOffs = Object.values(MILESTONE_THRESHOLD_DAYS).filter((t) => t > elapsed && t < threshold).length
  return weeks + months + oneOffs
}

function calendarMarkers(days: Day[]): HorizonMarker[] {
  const firstDate = days[0].date
  const elapsed = elapsedDays(days)
  const markers: HorizonMarker[] = []

  // 'week' repeats, so only the next one is ever ahead of you in a useful sense — listing week 7,
  // 8, 9... would bury the one-off marks that actually mean something.
  //
  // Counted through weekMarkElapsed, the same way the road lays the badge it will become: the grey
  // mark listed here and the real one that eventually stands on the road have to be the same mark,
  // or the road grows a seam where the two griddings meet.
  const nextWeek = weekMarksThrough(firstDate, elapsed) + 1
  const weekThreshold = weekMarkElapsed(firstDate, nextWeek)
  markers.push({
    kind: 'calendar',
    label: `${MILESTONE_LABEL.week} ${nextWeek}`,
    daysAhead: weekThreshold - elapsed,
    milestone: 'week',
    milestoneN: nextWeek,
    milestoneDate: addDaysISO(firstDate, weekThreshold),
    slotsAhead: weekThreshold - elapsed + chipsBefore(firstDate, elapsed, weekThreshold, 'week'),
  })

  // Same reasoning as the week: only the next one is ever usefully ahead of you.
  const nextMonth = monthMarksThrough(firstDate, elapsed) + 1
  const monthThreshold = monthMarkElapsed(firstDate, nextMonth)
  markers.push({
    kind: 'calendar',
    label: MILESTONE_LABEL.month,
    daysAhead: monthThreshold - elapsed,
    milestone: 'month',
    milestoneN: nextMonth,
    milestoneDate: addDaysISO(firstDate, monthThreshold),
    slotsAhead: monthThreshold - elapsed + chipsBefore(firstDate, elapsed, monthThreshold, 'month'),
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
        milestoneDate: addDaysISO(firstDate, threshold),
        slotsAhead: daysAhead + chipsBefore(firstDate, elapsed, threshold, 'oneOff'),
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
      const daysAhead = Math.ceil(progress.nextRank.days - progress.progressDays)
      if (daysAhead <= 0) continue
      markers.push({
        kind: 'tier',
        label: `${task.title} · ${rankLabel(progress.nextRank)}`,
        daysAhead,
        taskId: task.id,
      })
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
