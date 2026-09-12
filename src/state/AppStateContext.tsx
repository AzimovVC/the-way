import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppState } from '../domain/models'
import { applyPathGeometry, getLogicalToday, reconcileMissedDays } from '../domain/pathEngine'
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

  useEffect(() => {
    setStateInternal((prev) => {
      if (prev.days.length === 0) return prev
      const lastDate = prev.days.reduce((max, d) => (d.date > max ? d.date : max), prev.days[0].date)
      const today = getLogicalToday(new Date())
      if (lastDate >= today) return prev
      const next: AppState = { ...prev, days: applyPathGeometry(reconcileMissedDays(lastDate, today, prev.days)) }
      saveState(next)
      return next
    })
  }, [])

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
