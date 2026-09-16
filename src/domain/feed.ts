import { findComebacks, type Comeback } from './comeback'
import type { AppState, TaskChange } from './models'
import { applyPathGeometry, computeMilestones, type MilestoneKind } from './pathEngine'
import type { RankId } from './ranks'

/** A calendar mark the road lays down. 'week' is deliberately not here — see buildFeed. */
export type FeedCalendarMark = Exclude<MilestoneKind, 'week'>

export type FeedEvent =
  | { kind: 'calendar'; mark: FeedCalendarMark }
  | { kind: 'goal'; goalId: string; title: string }
  | { kind: 'rank'; taskId: string; title: string; rank: RankId; days: number }
  | { kind: 'target'; taskId: string; title: string; days: number }
  | { kind: 'comeback'; comeback: Comeback }
  | { kind: 'taskChange'; change: TaskChange }
  | { kind: 'freeze' }

export interface FeedEntry {
  date: string
  /**
   * Whether this gets a card of its own or a single line inside the day's group.
   *
   * Not decoration: over half a year the quiet kinds outnumber the loud ones roughly three to two
   * — freezes alone can run to twelve — and a feed where a spent freeze looks the same size as a
   * rank is a feed nobody finishes reading.
   */
  loud: boolean
  event: FeedEvent
}

/** One day of the feed. Entries are already ordered: loud first, then the quiet lines. */
export interface FeedDay {
  date: string
  entries: FeedEntry[]
}

/**
 * What every task the history mentions is called — live templates first, then the name a finished
 * habit left behind in the day it stopped being asked for.
 *
 * A rank taken by a habit that was later closed still belongs in the feed, and by then its template
 * is gone from the goal: the `taskChanges` snapshot is the only thing left that knows the name.
 * Same reasoning, and the same source, as the finished cards on the habits shelf (showcase.ts).
 */
export function taskTitleById(state: AppState): Map<string, string> {
  const titles = new Map<string, string>()
  for (const day of state.days) {
    for (const change of day.taskChanges ?? []) titles.set(change.taskId, change.title)
  }
  // Live templates win: a renamed habit is called by the name it has now, while each past day keeps
  // the name it was judged under in its own stamp.
  for (const goal of state.user.goals) {
    for (const task of goal.tasks) titles.set(task.id, task.title)
  }
  return titles
}

/**
 * The road, read backwards in words.
 *
 * Everything here is **derived**, never stored. That is the same rule the comeback lives by, and for
 * the same reason: a stored copy of an event would one day disagree with the road that event is
 * drawn on, and the person would read about a return above a road that never turned. It also means
 * a restored backup re-derives the whole feed rather than arriving with someone else's blanks.
 *
 * Two rules decide what is allowed in:
 *
 * - **nothing that judges a day a second time.** No misses, no red days, no broken streaks, no
 *   percentages. The road already draws all of that, and a line of text repeating it would be the
 *   dark half this app does not have;
 * - **a mark the road already draws may appear only when the feed adds what the chip cannot** — its
 *   date, and a way back to the day. That is why the month and the start are here.
 *
 * And why `week` is not: `computeMilestones` lays a weekly chip every seven days, which is
 * twenty-six entries over half a year against roughly twenty for everything else put together.
 * «НЕДЕЛЯ 17» is a cadence, not news, and a feed made mostly of it stops being read at all.
 */
export function buildFeed(state: AppState): FeedDay[] {
  // Geometry is recomputed here rather than read off the record, and this is not belt and braces:
  // `pathAngleDelta` is a derived field that happens to be persisted, so a record written by
  // something that did not run applyPathGeometry carries zeros, and a comeback read from zeros is
  // no comeback at all — the screen loses the one event it exists for, silently, on some states and
  // not others. The function is pure and idempotent: on an up-to-date record it changes nothing.
  const days = applyPathGeometry(state.days)
  if (days.length === 0) return []

  const titles = taskTitleById(state)
  const goalTitles = new Map(state.user.goals.map((g) => [g.id, g.title]))
  const entries: FeedEntry[] = []

  // The calendar marks, taken from the very function that lays them on the road — so a mark can
  // never be in the feed on a day the road does not carry it.
  for (const milestone of computeMilestones(days)) {
    if (milestone.kind === 'week') continue
    entries.push({ date: days[milestone.index].date, loud: true, event: { kind: 'calendar', mark: milestone.kind } })
  }

  for (const day of days) {
    for (const goalId of day.newGoalIds ?? []) {
      entries.push({
        date: day.date,
        loud: true,
        event: { kind: 'goal', goalId, title: goalTitles.get(goalId) ?? 'Новая привычка' },
      })
    }
    for (const reached of day.milestonesReached ?? []) {
      entries.push({
        date: day.date,
        loud: true,
        event: {
          kind: 'rank',
          taskId: reached.taskId,
          title: titles.get(reached.taskId) ?? 'Привычка',
          rank: reached.rank,
          days: reached.days,
        },
      })
    }
    for (const reached of day.targetsReached ?? []) {
      entries.push({
        date: day.date,
        loud: true,
        event: {
          kind: 'target',
          taskId: reached.taskId,
          title: titles.get(reached.taskId) ?? 'Привычка',
          days: reached.days,
        },
      })
    }
    for (const change of day.taskChanges ?? []) {
      entries.push({ date: day.date, loud: false, event: { kind: 'taskChange', change } })
    }
    // A rest day is the schedule doing its job and says nothing; a spent freeze is a decision that
    // held a day which would otherwise have counted against you.
    if (day.frozen) entries.push({ date: day.date, loud: false, event: { kind: 'freeze' } })
  }

  for (const comeback of findComebacks(days)) {
    entries.push({ date: comeback.confirmedDate, loud: true, event: { kind: 'comeback', comeback } })
  }

  const byDate = new Map<string, FeedEntry[]>()
  for (const entry of entries) {
    const bucket = byDate.get(entry.date)
    if (bucket) bucket.push(entry)
    else byDate.set(entry.date, [entry])
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, dayEntries]) => ({
      date,
      entries: dayEntries.sort((a, b) => Number(b.loud) - Number(a.loud)),
    }))
}

/** How many entries a feed holds, for the «показать раньше» cut. */
export function countEntries(feed: FeedDay[]): number {
  return feed.reduce((sum, day) => sum + day.entries.length, 0)
}

/**
 * The newest `limit` entries, whole days at a time.
 *
 * Whole days, because a day group cut in half reads as if the rest of that day never happened —
 * and the cut is there for length, not to hide anything.
 */
export function takeEntries(feed: FeedDay[], limit: number): FeedDay[] {
  const taken: FeedDay[] = []
  let count = 0
  for (const day of feed) {
    if (count >= limit) break
    taken.push(day)
    count += day.entries.length
  }
  return taken
}
