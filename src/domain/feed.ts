import { dayWord, daysBetween, hourWord, minuteWord } from './calendar'
import { findComebacks, type Comeback } from './comeback'
import { FEED_WINDOW_DAYS } from './config'
import type { AppState, TaskChange } from './models'
import { addDaysISO, applyPathGeometry, computeMilestones, type MilestoneKind } from './pathEngine'
import type { RankId } from './ranks'

/** A calendar mark the road lays down. 'week' is deliberately not here — see buildFeed. */
export type FeedCalendarMark = Exclude<MilestoneKind, 'week'>

export type FeedEvent =
  | { kind: 'calendar'; mark: FeedCalendarMark }
  | { kind: 'goal'; goalId: string; title: string }
  | { kind: 'rank'; taskId: string; title: string; rank: RankId; days: number }
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
  /**
   * The moment it happened, when there is one — so the row can say «2 часа назад» instead of
   * «Сегодня».
   *
   * Absent on everything **derived**: a road mark, a return and the calendar chips are read back
   * out of history, and history keeps days, not minutes. Absent too on a freeze, which is a flag on
   * a day. Those rows go on saying their age in days, and that is not a gap to be filled later with
   * a guess — a made-up hour is the same invented precision the habit's personal target was thrown
   * out for.
   */
  at?: string
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
 *   app saying the same bad news twice;
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
  // The goal keeps its own minute (`createdAt`), and the day only keeps the id — so the moment is
  // looked up here, the same way the title is.
  const goalMoments = new Map(state.user.goals.map((g) => [g.id, g.createdAt]))
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
        at: goalMoments.get(goalId),
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
        at: reached.at,
      })
    }
    for (const change of day.taskChanges ?? []) {
      entries.push({ date: day.date, loud: false, event: { kind: 'taskChange', change }, at: change.at })
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

/**
 * Самый ранний день, который лента показывает.
 *
 * Считается от сегодня, а не от понедельника: лента — поток, а не сводка, и «неделя» здесь длина
 * отрезка, а не календарная клетка. Понедельничная граница означала бы, что в понедельник утром
 * лента пуста, а в воскресенье вечером полна, — то есть что жизнь друзей зависит от дня недели.
 */
export function feedSince(today: string, windowDays: number = FEED_WINDOW_DAYS): string {
  return addDaysISO(today, -(windowDays - 1))
}

/** Дни ленты не раньше `since`. Целыми днями: половина дня читается как «остального не было». */
export function feedSinceDays(feed: FeedDay[], since: string): FeedDay[] {
  return feed.filter((day) => day.date >= since)
}

/**
 * Имя события — **выведенное, а не отчеканенное**, и это единственный такой ключ в приложении.
 *
 * Правило «ключ приезжает вместе с действием» (`newId` в [ids.ts](./ids.ts)) про вещи, которые
 * человек завёл. Событие ленты никто не заводил: оно следствие, выводимое из дороги на каждом
 * чтении, — как возвращение, у которого по той же причине нет копии в состоянии.
 *
 * Выдуманный ключ стоил бы здесь дорого и молча. Восстановивший копию перевыводит ленту целиком, и
 * события получили бы новые имена — вместе со всеми сердцами, которые на них стояли. Ключ, собранный
 * из дня, рода и самой вещи, после восстановления совпадает сам с собой.
 *
 * `null` значит «это событие наружу не едет»: заморозка и правки расписания — служебные пометки
 * собственной истории, а возвращение существует только там, где был спад, и на чужом экране
 * рассказывало бы про провал человека, который его не рассказывал.
 */
export function feedEventId(
  date: string,
  event: FeedEvent,
  hidden: ReadonlySet<string> = EMPTY,
): string | null {
  if (event.kind === 'calendar') return `${date}:calendar:${event.mark}`
  if (event.kind === 'goal') return hidden.has(event.goalId) ? null : `${date}:goal:${event.goalId}`
  if (event.kind === 'rank') return hidden.has(event.taskId) ? null : `${date}:rank:${event.taskId}:${event.rank}`
  return null
}

const EMPTY: ReadonlySet<string> = new Set()

/**
 * Ключи, о которых наружу не говорят: тихие привычки и цели, у которых тихие все.
 *
 * Считается **здесь**, а не на выгрузке, потому что отбор ленты стоит в одном месте по правилу:
 * `feedEventId` решает, что уезжает, и повторённое рядом второе такое же правило однажды разошлось
 * бы с первым — на своём экране сердце под строкой было бы, а сказать его было бы некому.
 *
 * Цель попадает сюда, только когда тихие **все** её привычки. Имя разбитой цели — это заголовок,
 * который человек написал над несколькими делами, и оно не называет ни одного из них; у неразбитой
 * имя цели и есть имя привычки, и одна тихая привычка — это и есть «все».
 */
export function hiddenFeedIds(state: AppState): ReadonlySet<string> {
  const hidden = new Set<string>()
  for (const goal of state.user.goals) {
    let quiet = goal.tasks.length > 0
    for (const task of goal.tasks) {
      if (task.private === true) hidden.add(task.id)
      else quiet = false
    }
    if (quiet) hidden.add(goal.id)
  }
  return hidden
}

/** Событие вместе с его именем — то, что уезжает на сервер и к чему цепляются сердца. */
export interface SharedEvent {
  id: string
  date: string
  event: FeedEvent
  /** Момент, если он есть, — чтобы у друга строка старела так же, как у тебя. См. `FeedEntry.at`. */
  at?: string
}

/**
 * Что из своей ленты видно друзьям.
 *
 * Свою половину ленты экран по-прежнему выводит сам, из дороги, где она богаче; наружу уезжает
 * только это — чтобы друг увидел строку и мог сказать ей сердце.
 *
 * `hidden` — ключи тихих привычек (`hiddenFeedIds`). Отбора здесь нет: список только передаётся
 * дальше, в `feedEventId`, где и стоит единственное правило о том, что видно друзьям.
 */
export function sharedEvents(feed: FeedDay[], hidden?: ReadonlySet<string>): SharedEvent[] {
  const shared: SharedEvent[] = []
  for (const day of feed) {
    for (const entry of day.entries) {
      const id = feedEventId(day.date, entry.event, hidden)
      if (id !== null) shared.push({ id, date: day.date, event: entry.event, at: entry.at })
    }
  }
  return shared
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * Сколько этому назад — то, что стоит под именем у каждого события.
 *
 * Раньше там стояла **подпись к роду события**: у каждой новой привычки «С этого дня дорога её
 * считает», у каждой метки «Здесь всё началось». Строка, одинаковая у всех событий одного рода,
 * не сообщает ничего — а в день, когда человек завёл четыре привычки, она стоит четыре раза
 * подряд и читается как заикание. Возраст же у каждой строки свой, и это ровно тот вопрос, с
 * которым в ленту приходят: давно ли.
 *
 * **Час — только там, где записан момент.** Новая привычка, правка расписания и выданная ступень
 * случились с человеком в названную секунду, и она лежит в записи (`FeedEntry.at`); метка дороги,
 * возвращение и заморозка **выводятся** из истории — у них есть день, но нет минуты. Считать её
 * задним числом было бы той же выдуманной точностью, за которую выкинута личная цель привычки,
 * поэтому такие строки по-прежнему говорят в днях.
 *
 * Дальше суток счёт всё равно переходит на дни: «26 часов назад» человек переводит в голове, а
 * «Вчера» — нет. Окно ленты неделя, поэтому дальше «6 дней назад» тут ничего не бывает.
 */
export function feedAge(date: string, today: string, at: string | undefined, nowMs: number): string {
  if (at !== undefined) {
    const moment = Date.parse(at)
    // Момент из будущего — это переведённые назад часы, а не новость, которой ещё не случилось.
    // Отрицательный возраст рисовать нечем, и день под ним верен по-прежнему.
    const elapsed = nowMs - moment
    if (Number.isFinite(moment) && elapsed >= 0 && elapsed < DAY_MS) {
      if (elapsed < MINUTE_MS) return 'Только что'
      if (elapsed < HOUR_MS) {
        const minutes = Math.floor(elapsed / MINUTE_MS)
        return `${minutes} ${minuteWord(minutes)} назад`
      }
      const hours = Math.floor(elapsed / HOUR_MS)
      return `${hours} ${hourWord(hours)} назад`
    }
  }

  const back = daysBetween(date, today)
  if (back <= 0) return 'Сегодня'
  if (back === 1) return 'Вчера'
  return `${back} ${dayWord(back)} назад`
}
