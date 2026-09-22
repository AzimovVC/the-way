import { createContext, useContext } from 'react'
import type { AppAction } from '../domain/actions'
import type { Comeback } from '../domain/comeback'
import type { MilestoneAward } from '../domain/milestoneAward'
import type { AppState } from '../domain/models'
import type { PredictionAward } from '../domain/predictionAward'

/** A level taken, waiting for its screen — the award as the domain builds it. */
export type CelebrationInfo = MilestoneAward

export interface AppStateContextValue {
  state: AppState
  /**
   * Действие человека внутри своей истории — отметка, дело, перестановка, правка привычки.
   * Возвращает получившееся состояние, потому что вызывающему иногда нужно то, что он только что
   * произвёл, а не следующий рендер.
   *
   * Обычный путь любой правки. `setState` рядом — не «то же самое покороче»: он для целого
   * состояния, пришедшего снаружи, и такого в приложении ровно три случая.
   */
  dispatch: (action: AppAction) => AppState
  /**
   * Целое состояние взамен нынешнего: первый день после онбординга, выдуманная история DevPanel.
   * Не правка записи, а другая запись, — поэтому и не действие.
   */
  setState: (next: AppState) => void
  /** Swaps in a state from outside the app (a restored backup), brought up to today first. */
  replaceState: (next: AppState) => void
  needsOnboarding: boolean
  /** Строка дня названа парой «день + привычка»: своего ключа у неё нет — см. `DayTask`. */
  toggleDayTask: (dayId: string, taskTemplateId: string) => void
  /**
   * Прибавить или убавить у привычки, которую считают по разам. Идёт тем же путём, что отметка,
   * потому что поднимает те же экраны: строка, закрывшаяся восьмым стаканом, — это тот же закрытый
   * день, что и строка, закрытая тапом.
   */
  stepDayTask: (dayId: string, taskTemplateId: string, delta: number) => void
  /**
   * A guess the habit has just walked out. First in the queue of screens: it is the rarest of them
   * — a couple of times in a habit's life against five rungs — and the only one that is about the
   * person rather than about the road.
   */
  pendingPrediction: PredictionAward | null
  dismissPrediction: () => void
  /**
   * Habits just created and not yet asked what their person expects of themselves — asked one at a
   * time, on a screen of their own. Lives only in this session: the question belongs to the minute
   * the habit was made, and a queue that survived a restart would greet someone with a form.
   */
  pendingPredictionAsks: { id: string; title: string; icon?: string }[]
  answerPredictionAsk: (days: number | null) => void
  /**
   * Queues the question for every habit that exists in `after` and did not in `before`. Called by
   * the creation flows and nowhere else — deliberately not folded into `setState`, which a restored
   * backup also goes through and which would then greet a returning person with a row of questions
   * about habits they made months ago.
   */
  askAboutNewHabits: (before: AppState, after: AppState) => void
  pendingCelebration: CelebrationInfo | null
  dismissCelebration: () => void
  /**
   * The comeback confirmed by the mark that was just made, waiting for its screen. Derived from
   * the road rather than stored on the day: the shape of the road already is the record, and a
   * second copy of it in the state could disagree with the picture.
   */
  pendingComeback: Comeback | null
  dismissComeback: () => void
  /**
   * The day that has just been closed in full, waiting for its summary screen. Set by the mark
   * that closed it and by nothing else: a day already closed when the app opens has had its
   * moment, and showing the screen again on every start would make it wallpaper.
   */
  pendingDayReviewId: string | null
  dismissDayReview: () => void
}

/**
 * The one store the app has, and the hook every screen reads it through — kept apart from the
 * provider that fills it, which is a component and lives in its own file.
 */
export const AppStateContext = createContext<AppStateContextValue | null>(null)

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
