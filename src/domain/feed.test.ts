import { describe, expect, it } from 'vitest'
import { buildFeed, takeEntries } from './feed'
import type { AppState, Day, Goal, TaskTemplate } from './models'

function makeDay(date: string, over: Partial<Day> = {}): Day {
  return {
    id: date,
    date,
    tasks: [],
    completionRate: 1,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: 'gold',
    frozen: false,
    ...over,
  }
}

/** `count` consecutive days from 2026-01-01, so a history long enough to cross a calendar mark. */
function runOfDays(count: number, over: (i: number) => Partial<Day> = () => ({})): Day[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
    return makeDay(date, over(i))
  })
}

function makeState(days: Day[], tasks: TaskTemplate[] = []): AppState {
  const goal: Goal = { id: 'g1', title: 'Быть здоровым', tasks, archived: false }
  return {
    user: {
      id: 'u1', name: 'Тестер', timezone: 'UTC', notificationsEnabled: false,
      freezesRemaining: 2, freezesRefilledMonth: '2026-01', goals: [goal],
    },
    days,
  }
}

const allEntries = (state: AppState) => buildFeed(state).flatMap((d) => d.entries)

describe('the feed', () => {
  it('never carries the weekly marks', () => {
    // Forty days is five weekly chips on the road and one month mark.
    const feed = allEntries(makeState(runOfDays(40)))
    const calendar = feed.filter((e) => e.event.kind === 'calendar')

    // Newest first, so the month stands above the start it counts from.
    expect(calendar.map((e) => (e.event.kind === 'calendar' ? e.event.mark : ''))).toEqual(['month', 'start'])
  })

  it('opens with the start, even on a history one day long', () => {
    const feed = buildFeed(makeState(runOfDays(1)))

    expect(feed).toHaveLength(1)
    expect(feed[0].entries[0].event).toEqual({ kind: 'calendar', mark: 'start' })
  })

  it('keeps the name of a habit that was closed, out of the day it left', () => {
    const days = runOfDays(3)
    days[1].milestonesReached = [{ taskId: 't1', goalId: 'g1', rank: 'novice', days: 7 }]
    days[2].taskChanges = [{ taskId: 't1', goalId: 'g1', title: 'Пробежка', kind: 'removed' }]
    // The goal holds no such task any more — the template is gone, the stamp is all that is left.
    const rank = allEntries(makeState(days)).find((e) => e.event.kind === 'rank')

    expect(rank?.event).toMatchObject({ kind: 'rank', title: 'Пробежка' })
  })

  it('calls a live habit by the name it has now', () => {
    const days = runOfDays(2)
    days[1].milestonesReached = [{ taskId: 't1', goalId: 'g1', rank: 'novice', days: 7 }]
    const task: TaskTemplate = {
      id: 't1', goalId: 'g1', title: 'Пробежка утром', cycleStartDate: '2026-01-01',
    }
    days[0].taskChanges = [{ taskId: 't1', goalId: 'g1', title: 'Пробежка', kind: 'added' }]
    const rank = allEntries(makeState(days, [task])).find((e) => e.event.kind === 'rank')

    expect(rank?.event).toMatchObject({ title: 'Пробежка утром' })
  })

  it('finds the comeback on a record whose stored geometry is stale', () => {
    // Two days kept, five missed, five kept — and every stored pathAngleDelta left at zero, which
    // is what a record written by anything that skipped applyPathGeometry looks like. Read as
    // stored, this history has no turns at all and therefore no comeback; the feed has to derive
    // the geometry to see the one event it exists for.
    const kept = [1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
    const days = runOfDays(kept.length, (i) => ({
      completionRate: kept[i],
      colorTier: kept[i] === 1 ? 'gold' : 'red',
      pathAngleDelta: 0,
    }))
    const comeback = allEntries(makeState(days)).find((e) => e.event.kind === 'comeback')

    expect(comeback).toBeDefined()
    // The entry sits on the day the return stopped being in doubt, never on the first good day:
    // a return announced on day one is a verdict on a day nobody has lived through yet.
    expect(comeback?.event.kind === 'comeback' && comeback.event.comeback.confirmedDate).toBe(comeback?.date)
    expect(comeback!.date > '2026-01-09').toBe(true)
  })

  it('reads days newest first, and loud above quiet within a day', () => {
    const days = runOfDays(3)
    days[2].taskChanges = [{ taskId: 't1', goalId: 'g1', title: 'Растяжка', kind: 'added' }]
    days[2].milestonesReached = [{ taskId: 't1', goalId: 'g1', rank: 'novice', days: 7 }]
    const feed = buildFeed(makeState(days))

    expect(feed[0].date).toBe('2026-01-03')
    expect(feed[feed.length - 1].date).toBe('2026-01-01')
    expect(feed[0].entries.map((e) => e.event.kind)).toEqual(['rank', 'taskChange'])
  })

  it('says nothing about a day that went badly', () => {
    const days = runOfDays(4, (i) => (i === 2 ? { colorTier: 'red', completionRate: 0 } : {}))
    const feed = allEntries(makeState(days))

    // Only the start. A red day is drawn on the road; a line of text about it would be a second
    // verdict, and that is the half this app does not have.
    expect(feed.map((e) => e.event.kind)).toEqual(['calendar'])
  })

  it('names a spent freeze, quietly', () => {
    const days = runOfDays(2, (i) => (i === 1 ? { frozen: true, colorTier: 'rest' } : {}))
    const freeze = allEntries(makeState(days)).find((e) => e.event.kind === 'freeze')

    expect(freeze?.loud).toBe(false)
  })

  it('cuts by whole days, never mid-day', () => {
    const days = runOfDays(3)
    days[1].taskChanges = [
      { taskId: 't1', goalId: 'g1', title: 'Растяжка', kind: 'added' },
      { taskId: 't2', goalId: 'g1', title: 'Чтение', kind: 'added' },
    ]
    days[2].taskChanges = [{ taskId: 't3', goalId: 'g1', title: 'Вода', kind: 'added' }]
    const cut = takeEntries(buildFeed(makeState(days)), 2)

    expect(cut).toHaveLength(2)
    expect(cut[1].entries).toHaveLength(2)
  })
})
