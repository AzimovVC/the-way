import { createContext, useContext } from 'react'
import type { CycleReport } from '../domain/milestones'
import type { AppState, Tier } from '../domain/models'

export interface CelebrationInfo {
  taskId: string
  goalId: string
  goalTitle: string
  tier: Exclude<Tier, 'none'>
  report: CycleReport
}

export interface AppStateContextValue {
  state: AppState
  setState: (next: AppState) => void
  /** Swaps in a state from outside the app (a restored backup), brought up to today first. */
  replaceState: (next: AppState) => void
  needsOnboarding: boolean
  toggleDayTask: (dayId: string, dayTaskId: string) => void
  pendingCelebration: CelebrationInfo | null
  dismissCelebration: () => void
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
