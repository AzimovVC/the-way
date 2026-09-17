import type { AppState } from './models'
import { isDayExcused, isTaskScheduledOn } from './schedule'

/**
 * What the goal plate says instead of repeating the goal's name at you.
 *
 * The plate holds the most visible slot on the path screen, and the goal's title is the one
 * thing there the user already knows by heart. The state of the day is what changes, and until
 * now it could only be read by finding today's circle on the road and tapping it — a target
 * that scrolls away.
 *
 * Everything here is a count or a plan, never a verdict: «осталось 2 из 3» is a fact, and the
 * road below is the only thing that gets to say how it is going.
 *
 * The big line **names what is left**, because that is the one thing the count cannot say: «1 из 3»
 * tells you how much, not which. It is text and nothing else — no boxes to tick. A second place to
 * mark a task would be a second place for one truth, and that place is the day card.
 *
 * What tomorrow asks for is not written here: it is written on tomorrow's own circle, which is
 * the thing it is about. Saying it in both places would be two homes for one truth.
 */
export interface TodayBrief {
  /**
   * The small line above, left: «Осталось».
   *
   * It carries the verb, and the verb is the whole meaning. «1 из 3» standing alone in a corner
   * reads in Russian as *one done of three* — the exact opposite — and reads that way silently:
   * nobody notices having understood the wrong day. Empty once nothing is owed.
   */
  label: string
  /** The small line above, right: «1 из 3». Empty when the number could not be otherwise. */
  count: string
  /** The big line: the names of what is left, or what a settled day has to say. */
  headline: string
  /** Names that did not fit the line, shown as «+2» beside it. */
  more: number
  /**
   * Whether today is owed nothing more — everything done, or a day that asked for nothing.
   *
   * Tomorrow is only worth pointing at once this is true. Read at nine in the morning with the
   * day still open, it pulls attention off the one day that is actually being decided; read once
   * today is closed, it is simply the next step.
   */
  settled: boolean
}

/**
 * How many characters of task names the big line holds.
 *
 * Derived, not guessed: the plate is the screen width less its side padding (390 − 24 = 366), less
 * the date cell (86) and the button's own padding (32), so the line gets ≈248px — about twenty
 * characters at 24px bold. Names past that are counted into `more` instead, because a name cut to
 * «Плава…» answers the question worse than «+1» does.
 */
const HEADLINE_BUDGET = 20

const MS_PER_DAY = 86_400_000

/**
 * The day after a YYYY-MM-DD date. Built in UTC for the same reason weekdayIndex parses in UTC:
 * these strings are calendar dates, not instants, and local arithmetic shifts them a day in
 * negative offsets — which would show somebody the wrong tomorrow.
 */
function nextDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + MS_PER_DAY).toISOString().slice(0, 10)
}

/** Titles of the tasks the given date will ask for, in goal order. */
function scheduledOn(state: AppState, date: string): string[] {
  const titles: string[] = []
  for (const goal of state.user.goals) {
    if (goal.archived) continue
    for (const task of goal.tasks) {
      if (isTaskScheduledOn(task, date)) titles.push(task.title)
    }
  }
  return titles
}

/** Titles of the task templates on a day, by template id — a finished habit simply has none. */
function titlesByTemplate(state: AppState): Map<string, string> {
  const byId = new Map<string, string>()
  for (const goal of state.user.goals) {
    for (const task of goal.tasks) byId.set(task.id, task.title)
  }
  return byId
}

/**
 * The names that fit the line, and how many were left over.
 *
 * Greedy rather than even: the first name is always whole, because the closer the day is to done,
 * the more the name is worth. With three of three left this is a to-do list, and that list has a
 * home in the day card; with one left, «Плавать 10 мин.» is the whole reason the screen was opened.
 *
 * The separator is «·», the one the app already uses between a thing and its detail — a full stop
 * would glue two names into one sentence.
 */
export function fitNames(titles: string[]): { line: string; more: number } {
  if (titles.length === 0) return { line: '', more: 0 }
  let line = titles[0]
  let i = 1
  for (; i < titles.length; i++) {
    const next = `${line} · ${titles[i]}`
    const leftover = titles.length - i - 1
    const tail = leftover > 0 ? ` +${leftover}` : ''
    if (next.length + tail.length > HEADLINE_BUDGET) break
    line = next
  }
  return { line, more: titles.length - i }
}

export interface TomorrowPlan {
  date: string
  /** Titles tomorrow will ask for. Empty means a rest day — the road owes nothing on it. */
  titles: string[]
}

/** What the next day asks for, read through the schedule rather than through today's set. */
export function tomorrowPlan(state: AppState): TomorrowPlan {
  const today = state.days[state.days.length - 1]
  const date = today ? nextDate(today.date) : ''
  return { date, titles: date ? scheduledOn(state, date) : [] }
}

export function describeToday(state: AppState): TodayBrief {
  const empty = { label: '', count: '', more: 0 }
  const today = state.days[state.days.length - 1]
  if (!today) return { ...empty, headline: 'Путь ещё не начат', settled: false }

  // A rest day and a spent freeze both mean nothing is owed today — that is why the branch is
  // taken on the one predicate. The wording splits inside it because the two mean different
  // things to the person: a rest day was planned, a freeze was paid for.
  if (isDayExcused(today) || today.tasks.length === 0) {
    return {
      ...empty,
      headline: today.frozen ? 'Сегодня под заморозкой' : 'Сегодня выходной',
      settled: true,
    }
  }

  const total = today.tasks.length
  const left = today.tasks.filter((t) => !t.isDone)

  // Nothing left: the count goes with the names. «3 из 3» under «Сегодня всё» is a number that
  // could not have been anything else — the same tautology the review screens refuse to print.
  if (left.length === 0) return { ...empty, headline: 'Сегодня всё', settled: true }

  const byId = titlesByTemplate(state)
  const titles = left.map((t) => byId.get(t.taskTemplateId)).filter((t): t is string => !!t)
  const { line, more } = fitNames(titles)

  // No name resolved — then the count is all there is, and it takes the big line back rather than
  // leaving the plate with an empty one.
  if (!line) return { label: '', count: '', headline: `Осталось ${left.length} из ${total}`, more: 0, settled: false }

  // A single habit day prints no count: «1 из 1» is the only thing it could ever say while the day
  // is open, and the name below already says which one. Same rule the review tiles live by.
  const count = total > 1 ? `${left.length} из ${total}` : ''
  return { label: 'Осталось', count, headline: line, more, settled: false }
}
