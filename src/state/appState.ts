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
