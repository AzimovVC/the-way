import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppState } from '../domain/models'
import { applyPathGeometry, getLogicalToday, reconcileMissedDays } from '../domain/pathEngine'
import { loadState, saveState } from '../storage/appStorage'

interface AppStateContextValue {
  state: AppState
  setState: (next: AppState) => void
  needsOnboarding: boolean
  toggleDayTask: (dayId: string, dayTaskId: string) => void
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

  function toggleDayTask(dayId: string, dayTaskId: string) {
    const days = state.days.map((day) => {
      if (day.id !== dayId) return day

      const tasks = day.tasks.map((task) =>
        task.id === dayTaskId
          ? { ...task, isDone: !task.isDone, completedAt: !task.isDone ? new Date().toISOString() : null }
          : task,
      )

      const countable = tasks.filter((t) => !t.skipped)
      const completionRate = countable.length === 0 ? 0 : countable.filter((t) => t.isDone).length / countable.length

      return { ...day, tasks, completionRate }
    })

    setState({ ...state, days: applyPathGeometry(days) })
  }

  return (
    <AppStateContext.Provider value={{ state, setState, needsOnboarding, toggleDayTask }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
