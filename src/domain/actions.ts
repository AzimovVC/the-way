/**
 * Что человек сделал, названное одним значением.
 *
 * Раньше наружу уходило целиком новое состояние: экран собирал его сам (`setState(addTaskToGoal(state,
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
import { settleTogetherMark, stepDayTaskProgress, stopWaitingTogether, toggleDayTaskMark } from './dayLifecycle'
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
  | { kind: 'toggleTask'; dayId: string; taskTemplateId: string }
  /**
   * Шаг счётчика у привычки, которая считается по разам. Отдельным действием, а не вторым смыслом
   * у `toggleTask`: «отметил» и «прибавил один» — разные операции, и список, в котором они названы
   * одним словом, нельзя проиграть заново.
   */
  | { kind: 'stepTask'; dayId: string; taskTemplateId: string; delta: number }
  /**
   * Вторая половина отметилась — строка, ждавшая её, закрывается. Действием, а не чтением чужих
   * отметок изнутри правила: в состояние попадает вывод, сделанный снаружи, а не чужие данные.
   */
  | { kind: 'settleTogether'; dayId: string; taskTemplateId: string }
  /** Пара кончилась: привычка перестаёт кого-то ждать. См. `stopWaitingTogether`. */
  | { kind: 'stopWaiting'; taskId: string }
  | { kind: 'spendFreeze'; dayId: string }
  | { kind: 'setPrediction'; taskId: string; days: number }
  | { kind: 'updateProfile'; patch: Partial<Pick<User, 'name' | 'handle' | 'timezone' | 'notificationsEnabled' | 'habitsPublic'>> }

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
      return toggleDayTaskMark(state, action.dayId, action.taskTemplateId, now)
    case 'stepTask':
      return stepDayTaskProgress(state, action.dayId, action.taskTemplateId, action.delta, now)
    case 'settleTogether':
      return settleTogetherMark(state, action.dayId, action.taskTemplateId, now)
    case 'stopWaiting':
      return stopWaitingTogether(state, action.taskId, now)
    case 'spendFreeze':
      return spendFreezeOnDay(state, action.dayId)
    case 'setPrediction':
      return setPrediction(state, action.taskId, action.days)
    case 'updateProfile':
      return updateUserProfile(state, action.patch)
  }
}
