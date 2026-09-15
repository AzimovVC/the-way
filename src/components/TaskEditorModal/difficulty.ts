import type { TaskDifficulty } from '../../domain/config'

/**
 * What each difficulty is called on screen. Its own file because three screens name difficulties —
 * the editor, the goal flow and onboarding — and a label shared out of a component's file takes
 * that component's fast refresh down with it in dev.
 */
export const DIFFICULTY_LABEL: Record<TaskDifficulty, string> = {
  simple: 'Простая',
  medium: 'Средняя',
  hard: 'Сложная',
}
