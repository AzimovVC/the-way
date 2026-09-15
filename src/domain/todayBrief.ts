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
 */
export interface TodayBrief {
  /** The small line above: the goal, while there is exactly one to name. */
  goalLabel: string
  /** The large line: the state of today. */
  headline: string
  /** The small line under it, when there is something worth looking forward to. */
  detail: string | null
}

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

/**
 * The plate can only name one goal, so it names one only while that is the whole truth. With two
 * live goals it used to print whichever came first, which was a harmless half-truth while the big
 * line was the goal's own name — and stops being harmless now that the two lines read as one
 * sentence: «Пробежка · осталось 1 из 1» on a day that asks for Чтение is simply wrong.
 */
function goalLabelFor(state: AppState): string {
  const live = state.user.goals.filter((g) => !g.archived)
  return live.length === 1 ? live[0].title : live.length > 1 ? 'Твои цели' : 'Твоя цель'
}

function describeTomorrow(state: AppState, todayDate: string): string {
  const titles = scheduledOn(state, nextDate(todayDate))
  // A day nothing falls on is a rest day, and the road treats it as owed nothing — so it is
  // announced as a rest day, not as an empty list.
  return titles.length === 0 ? 'Завтра выходной' : `Завтра: ${titles.join(', ')}`
}

export function describeToday(state: AppState): TodayBrief {
  const goalLabel = goalLabelFor(state)
  const today = state.days[state.days.length - 1]
  if (!today) return { goalLabel, headline: 'Путь ещё не начат', detail: null }

  // A rest day and a spent freeze both mean nothing is owed today — that is why the branch is
  // taken on the one predicate. The wording splits inside it because the two mean different
  // things to the person: a rest day was planned, a freeze was paid for.
  if (isDayExcused(today) || today.tasks.length === 0) {
    return {
      goalLabel,
      headline: today.frozen ? 'Сегодня под заморозкой' : 'Сегодня выходной',
      detail: describeTomorrow(state, today.date),
    }
  }

  const total = today.tasks.length
  const remaining = today.tasks.filter((t) => !t.isDone).length

  if (remaining > 0) return { goalLabel, headline: `Осталось ${remaining} из ${total}`, detail: null }

  return { goalLabel, headline: 'Сегодня всё', detail: describeTomorrow(state, today.date) }
}
