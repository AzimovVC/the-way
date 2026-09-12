import type { Day } from './models'

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
        .every((d) => d.frozen || (d.tasks.length > 0 && d.tasks.every((t) => t.isDone)))
    },
  },
  {
    id: 'before_noon',
    text: 'Выполни хотя бы одну задачу до обеда',
    isComplete: (day) =>
      day.tasks.some((t) => t.isDone && t.completedAt !== null && new Date(t.completedAt).getHours() < 12),
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
  const hash = hashString(day.date)
  const count = 1 + (hash % 2)
  const startIndex = hash % QUEST_POOL.length

  const picked: QuestDefinition[] = []
  for (let i = 0; i < count; i++) {
    picked.push(QUEST_POOL[(startIndex + i) % QUEST_POOL.length])
  }

  return picked.map((q) => ({ id: q.id, text: q.text, isComplete: q.isComplete(day, days) }))
}
