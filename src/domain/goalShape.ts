import type { Goal } from './models'
import type { PartOfDay } from './partOfDay'

export interface GoalTaskDraft {
  /** Ключ будущей привычки — см. [ids.ts](./ids.ts). Чеканит его тот, кто набирал форму. */
  id: string
  title: string
  weekdays?: number[]
  partOfDay?: PartOfDay
  icon?: string
  predictedDays?: number
  private?: boolean
  /** Сколько раз за день, если привычка считается по разам. См. `TaskTemplate.target`. */
  target?: { count: number; unit: string }
  /** Привычка, которую бросают: отметка значит «удержался». См. `TaskTemplate.quit`. */
  quit?: boolean
}

/**
 * Two levels — goal and daily task — earn their keep only when one goal is several actions
 * («Спортсмен» → пробежка + зарядка). When the goal *is* the action, asking for a second name
 * asks for something the user does not have, and they type filler to get past the screen.
 *
 * So a goal with nothing under it means one task, under the goal's own name. Splitting it is a
 * deliberate extra step, not the price of entry.
 */
export function tasksForGoal(
  title: string,
  split: GoalTaskDraft[],
  single: Omit<GoalTaskDraft, 'title'>,
): GoalTaskDraft[] {
  if (split.length > 0) return split
  // Ключ приходит снаружи и в этом случае: неразбитая цель заводит одну привычку, и она такая же
  // новая вещь, как остальные. Отчеканить его здесь значило бы вернуть ту же беду на один уровень
  // выше — правило снова придумывало бы имя само.
  return [{ title, ...single }]
}

/**
 * True when a goal is still that single unsplit action, and screens should show one line rather
 * than a heading with a list of one under it. Matched by title, not by count: a goal with one
 * task called something else — «Французский» → «20 слов» — is two real facts, and collapsing it
 * would hide the one the user chose to write.
 */
export function isSingleTaskGoal(goal: Goal): boolean {
  return goal.tasks.length === 1 && goal.tasks[0].title === goal.title
}
