/**
 * Что человек сделал, названное одним значением.
 *
 * Раньше наружу уходило целиком новое состояние: экран собирал его сам (`setState(addChore(state,
 * …))`) и отдавал дереву. Работало, но за границу уезжал весь путь целиком, а операция —
 * «Серёжа отметил задачу T в дне 2026-09-17» — нигде не существовала как вещь. Теперь существует,
 * и из этого следует три вещи, каждая из которых иначе стоила бы переписывания вызывающих:
 *
 * - отправить можно **изменение**, а не всю историю — без этого не бывает общих привычек;
 * - список действий воспроизводит состояние, поэтому его можно проиграть заново или отменить;
 * - домен по-прежнему не знает ни о каком «действии»: здесь только диспетчер, а правила остаются
 *   в тех же чистых функциях, что и были.
 *
 * Сюда попадает то, что человек делает **внутри** своей истории. Целое состояние, пришедшее
 * снаружи, — восстановленная копия, первый день после онбординга, выдуманная история DevPanel —
 * действием не является и идёт мимо: это не правка записи, а другая запись.
 */
import { addChore, removeChore, toggleChore, type NewChoreInput } from './chores'
import { toggleDayTaskMark } from './dayLifecycle'
import { spendFreezeOnDay } from './freezes'
import {
  addGoalMidPath,
  addTaskToGoal,
  archiveGoal,
  editTaskInGoal,
  removeTaskFromGoal,
  updateUserProfile,
  type NewGoalInput,
  type NewTaskInput,
  type TaskEdit,
} from './goalManagement'
import type { AppState, User } from './models'
import { setPrediction } from './prediction'
import { reorderTasks } from './taskOrder'

export type AppAction =
  | { kind: 'addGoal'; input: NewGoalInput }
  | { kind: 'addTask'; goalId: string; input: NewTaskInput }
  | { kind: 'editTask'; goalId: string; taskId: string; input: TaskEdit }
  | { kind: 'removeTask'; goalId: string; taskId: string }
  | { kind: 'archiveGoal'; goalId: string }
  | { kind: 'reorderTasks'; taskIds: string[] }
  | { kind: 'toggleTask'; dayId: string; dayTaskId: string }
  | { kind: 'spendFreeze'; dayId: string }
  | { kind: 'addChore'; input: NewChoreInput }
  | { kind: 'toggleChore'; choreId: string }
  | { kind: 'removeChore'; choreId: string }
  | { kind: 'setPrediction'; taskId: string; days: number }
  | { kind: 'updateProfile'; patch: Partial<Pick<User, 'name' | 'handle' | 'timezone' | 'notificationsEnabled'>> }

/**
 * Применяет действие. Чистая и с явным `now`: то же действие с тем же временем даёт то же
 * состояние — без этого «проиграть список заново» означало бы «получить другую историю».
 */
export function applyAction(state: AppState, action: AppAction, now: Date = new Date()): AppState {
  switch (action.kind) {
    case 'addGoal':
      return addGoalMidPath(state, action.input, now)
    case 'addTask':
      return addTaskToGoal(state, action.goalId, action.input, now)
    case 'editTask':
      return editTaskInGoal(state, action.goalId, action.taskId, action.input, now)
    case 'removeTask':
      return removeTaskFromGoal(state, action.goalId, action.taskId, now)
    case 'archiveGoal':
      return archiveGoal(state, action.goalId, now)
    case 'reorderTasks':
      return reorderTasks(state, action.taskIds)
    case 'toggleTask':
      return toggleDayTaskMark(state, action.dayId, action.dayTaskId, now)
    case 'spendFreeze':
      return spendFreezeOnDay(state, action.dayId)
    case 'addChore':
      return addChore(state, action.input)
    case 'toggleChore':
      return toggleChore(state, action.choreId, now)
    case 'removeChore':
      return removeChore(state, action.choreId)
    case 'setPrediction':
      return setPrediction(state, action.taskId, action.days)
    case 'updateProfile':
      return updateUserProfile(state, action.patch)
  }
}
