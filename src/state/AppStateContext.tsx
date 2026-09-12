import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AppState } from '../domain/models'
import { loadState, saveState } from '../storage/appStorage'

interface AppStateContextValue {
  state: AppState
  setState: (next: AppState) => void
  needsOnboarding: boolean
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setStateInternal] = useState<AppState>(() => loadState())

  const setState = (next: AppState) => {
    setStateInternal(next)
    saveState(next)
  }

  const needsOnboarding = useMemo(
    () => !state.user.goals.some((goal) => goal.tasks.length > 0),
    [state.user.goals],
  )

  return (
    <AppStateContext.Provider value={{ state, setState, needsOnboarding }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
