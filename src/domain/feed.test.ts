import { describe, expect, it } from 'vitest'
import { buildFeed, feedAge, feedEventId, feedSince, feedSinceDays, sharedEvents, takeEntries } from './feed'
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

describe('feedSince', () => {
  it('окно включает сегодня и шесть дней до него', () => {
    // Семь дней, а не «минус семь»: неделя, в которой сегодня — седьмой день, а не восьмой.
    expect(feedSince('2026-09-22', 7)).toBe('2026-09-16')
  })

  it('режет целыми днями', () => {
    const feed = buildFeed(makeState(runOfDays(40)))
    const cut = feedSinceDays(feed, '2026-01-30')
    expect(cut.every((day) => day.date >= '2026-01-30')).toBe(true)
  })
})

describe('feedEventId', () => {
  it('одно и то же событие зовётся одинаково при каждом выводе', () => {
    // Это и есть весь смысл выведенного ключа: восстановивший копию перевыводит ленту целиком, и
    // выдуманное имя увело бы с собой все сердца, которые на событии стояли.
    const days = runOfDays(30, (i) => (i === 20 ? { milestonesReached: [{ taskId: 't1', goalId: 'g1', rank: 'apprentice' as const, days: 21 }] } : {}))
    const first = allEntries(makeState(days)).find((e) => e.event.kind === 'rank')
    const again = allEntries(makeState(days)).find((e) => e.event.kind === 'rank')
    expect(first).toBeDefined()
    expect(feedEventId('2026-01-21', first!.event)).toBe(feedEventId('2026-01-21', again!.event))
  })

  it('возвращение наружу не едет', () => {
    // Возвращение существует только там, где был спад, и на чужом экране рассказывало бы про
    // провал человека, который его не рассказывал.
    const kept = [1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
    const days = runOfDays(kept.length, (i) => ({
      completionRate: kept[i],
      colorTier: kept[i] === 1 ? 'gold' : 'red',
      pathAngleDelta: 0,
    }))
    const comeback = allEntries(makeState(days)).find((e) => e.event.kind === 'comeback')
    expect(comeback).toBeDefined()
    expect(feedEventId(comeback!.date, comeback!.event)).toBeNull()
  })

  it('заморозка и правки расписания наружу не едут', () => {
    const days = runOfDays(5, (i) => (i === 2 ? { frozen: true } : {}))
    const freeze = allEntries(makeState(days)).find((e) => e.event.kind === 'freeze')
    expect(freeze).toBeDefined()
    expect(feedEventId(freeze!.date, freeze!.event)).toBeNull()
  })

  it('sharedEvents отдаёт только то, у чего есть имя', () => {
    const days = runOfDays(40, (i) => (i === 2 ? { frozen: true } : {}))
    const shared = sharedEvents(buildFeed(makeState(days)))
    expect(shared.length).toBeGreaterThan(0)
    expect(shared.every((event) => event.event.kind !== 'freeze')).toBe(true)
    expect(shared.every((event) => event.id.startsWith(event.date))).toBe(true)
  })
})

describe('feedAge', () => {
  const TODAY = '2026-09-22'
  const NOW = Date.parse('2026-09-22T14:00:00.000Z')

  it('без момента считает в днях', () => {
    expect(feedAge(TODAY, TODAY, undefined, NOW)).toBe('Сегодня')
    expect(feedAge('2026-09-21', TODAY, undefined, NOW)).toBe('Вчера')
    expect(feedAge('2026-09-19', TODAY, undefined, NOW)).toBe('3 дня назад')
    expect(feedAge('2026-09-17', TODAY, undefined, NOW)).toBe('5 дней назад')
  })

  it('с моментом считает в часах и минутах', () => {
    const ago = (ms: number) => new Date(NOW - ms).toISOString()
    expect(feedAge(TODAY, TODAY, ago(30_000), NOW)).toBe('Только что')
    expect(feedAge(TODAY, TODAY, ago(60_000), NOW)).toBe('1 минуту назад')
    expect(feedAge(TODAY, TODAY, ago(5 * 60_000), NOW)).toBe('5 минут назад')
    expect(feedAge(TODAY, TODAY, ago(42 * 60_000), NOW)).toBe('42 минуты назад')
    expect(feedAge(TODAY, TODAY, ago(60 * 60_000), NOW)).toBe('1 час назад')
    expect(feedAge(TODAY, TODAY, ago(2 * 3600_000), NOW)).toBe('2 часа назад')
    expect(feedAge(TODAY, TODAY, ago(9 * 3600_000), NOW)).toBe('9 часов назад')
  })

  it('дальше суток возвращается к дням', () => {
    // «26 часов назад» человек переводит в голове, «Вчера» — нет.
    const long = new Date(NOW - 26 * 3600_000).toISOString()
    expect(feedAge('2026-09-21', TODAY, long, NOW)).toBe('Вчера')
  })

  it('момент из будущего — это переведённые часы, а не новость, которой не случилось', () => {
    const ahead = new Date(NOW + 2 * 3600_000).toISOString()
    expect(feedAge(TODAY, TODAY, ahead, NOW)).toBe('Сегодня')
    expect(feedAge(TODAY, TODAY, 'вчера вечером', NOW)).toBe('Сегодня')
  })
})
