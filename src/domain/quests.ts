import { DAY_BOUNDARY_HOUR } from './config'
import type { Day } from './models'
import { isDayExcused } from './schedule'
import { logicalHourOf } from './timeOfDay'

export type QuestId = 'two_tasks' | 'streak_3' | 'before_noon'

interface QuestDefinition {
  id: QuestId
  text: string
  isComplete: (day: Day, days: Day[]) => boolean
}

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

const QUEST_POOL: QuestDefinition[] = [
  {
    id: 'two_tasks',
    text: 'Выполни 2 задачи сегодня',
    isComplete: (day) => day.tasks.filter((t) => t.isDone).length >= 2,
  },
  {
    id: 'streak_3',
    text: '3 дня подряд без пропуска',
    isComplete: (day, days) => {
      const sorted = sortedByDate(days)
      const idx = sorted.findIndex((d) => d.id === day.id)
      if (idx < 2) return false
      return sorted
        .slice(idx - 2, idx + 1)
        .every((d) => isDayExcused(d) || (d.tasks.length > 0 && d.tasks.every((t) => t.isDone)))
    },
  },
  {
    id: 'before_noon',
    text: 'Выполни хотя бы одну задачу до обеда',
    // Read on the logical day's scale, or a mark at 00:40 — the tail end of the day that is
    // closing — would count as hour 0 and quietly pass for "before noon".
    isComplete: (day) =>
      day.tasks.some((t) => {
        const hour = t.isDone ? logicalHourOf(t) : null
        return hour !== null && hour < 12 && hour >= DAY_BOUNDARY_HOUR
      }),
  },
]

function hashString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return hash >>> 0
}

export interface DailyQuest {
  id: QuestId
  text: string
  isComplete: boolean
}

/**
 * 1–2 bonus quests for the given day, deterministically picked from a fixed
 * pool by date so they're stable across rerenders and don't need persisted
 * state. Purely a motivational overlay — never feeds into path angle/color.
 */
export function dailyQuestsFor(day: Day, days: Day[]): DailyQuest[] {
  // A day off asks for nothing, so it cannot carry a bonus goal either. Handing someone
  // «выполни 2 задачи» on a day with no tasks is a dare to break their own schedule.
  if (day.rest) return []

  const hash = hashString(day.date)
  const count = 1 + (hash % 2)
  const startIndex = hash % QUEST_POOL.length

  const picked: QuestDefinition[] = []
  for (let i = 0; i < count; i++) {
    picked.push(QUEST_POOL[(startIndex + i) % QUEST_POOL.length])
  }

  return picked.map((q) => ({ id: q.id, text: q.text, isComplete: q.isComplete(day, days) }))
}
