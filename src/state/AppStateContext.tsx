import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { EXP_PER_COMPLETION } from '../domain/config'
import { rollForwardToToday } from '../domain/dayLifecycle'
import { levelFromExp } from '../domain/habitLevel'
import { buildCycleReport, computeMilestoneProgress } from '../domain/milestones'
import type { AppState } from '../domain/models'
import { addDaysISO, applyPathGeometry } from '../domain/pathEngine'
import { loadState, saveState } from '../storage/appStorage'
import { AppStateContext, type CelebrationInfo } from './appState'

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Loaded and brought up to today in one step, before the first paint. The app may have been
  // closed for days, and the road must be current before anything draws it: doing this in an effect
  // instead would paint yesterday's road and then replace it, at the cost of a second render on
  // every start.
  const [opening] = useState(() => {
    const loaded = loadState()
    return { loaded, rolled: rollForwardToToday(loaded, new Date()) }
  })
  const [state, setStateInternal] = useState<AppState>(opening.rolled)
  const [pendingCelebration, setPendingCelebration] = useState<CelebrationInfo | null>(null)

  const setState = (next: AppState) => {
    setStateInternal(next)
    saveState(next)
  }

  // A whole state arriving from outside the running app — a restored backup. It was written on
  // some past day, so it gets the same roll-forward a cold start gets; handing it to setState
  // raw would draw a road that stops on the day the copy was made.
  const replaceState = (next: AppState) => setState(rollForwardToToday(next, new Date()))

  // What the roll-forward produced lives only in memory until it is written. A start that is closed
  // again straight away would otherwise repeat the same work — and, worse, re-derive it from a save
  // that still says yesterday.
  useEffect(() => {
    if (opening.rolled !== opening.loaded) saveState(opening.rolled)
  }, [opening])

  const needsOnboarding = useMemo(
    () => !state.user.goals.some((goal) => goal.tasks.length > 0),
    [state.user.goals],
  )

  function toggleDayTask(dayId: string, dayTaskId: string) {
    const day = state.days.find((d) => d.id === dayId)
    const dayTask = day?.tasks.find((t) => t.id === dayTaskId)
    if (!day || !dayTask) return

    const willBeDone = !dayTask.isDone

    const days = state.days.map((d) => {
      if (d.id !== dayId) return d
      const tasks = d.tasks.map((t) =>
        t.id === dayTaskId ? { ...t, isDone: willBeDone, completedAt: willBeDone ? new Date().toISOString() : null } : t,
      )
      const countable = tasks.filter((t) => !t.skipped)
      const completionRate = countable.length === 0 ? 0 : countable.filter((t) => t.isDone).length / countable.length
      return { ...d, tasks, completionRate }
    })

    let goals = state.user.goals.map((goal) => ({
      ...goal,
      tasks: goal.tasks.map((task) => {
        if (task.id !== dayTask.taskTemplateId) return task
        const expDelta = willBeDone ? EXP_PER_COMPLETION : -EXP_PER_COMPLETION
        const habitExp = Math.max(0, task.habitExp + expDelta)
        return { ...task, habitExp, habitLevel: levelFromExp(habitExp) }
      }),
    }))

    let nextDays = applyPathGeometry(days)
    let celebration: CelebrationInfo | null = null

    if (willBeDone) {
      const goal = goals.find((g) => g.tasks.some((t) => t.id === dayTask.taskTemplateId))
      const task = goal?.tasks.find((t) => t.id === dayTask.taskTemplateId)
      if (goal && task) {
        const progress = computeMilestoneProgress(task, nextDays)
        if (progress.reachedTier) {
          const reachedTier = progress.reachedTier
          const nextCycleStart = addDaysISO(nextDays[nextDays.length - 1]?.date ?? day.date, 1)
          goals = goals.map((g) =>
            g.id === goal.id
              ? {
                  ...g,
                  tasks: g.tasks.map((t) =>
                    t.id === task.id ? { ...t, currentTier: reachedTier, cycleStartDate: nextCycleStart } : t,
                  ),
                }
              : g,
          )
          nextDays = nextDays.map((d) =>
            d.id === dayId
              ? { ...d, milestonesReached: [...(d.milestonesReached ?? []), { taskId: task.id, goalId: goal.id, tier: reachedTier }] }
              : d,
          )
          celebration = {
            taskId: task.id,
            goalId: goal.id,
            goalTitle: goal.title,
            tier: reachedTier,
            report: buildCycleReport(task, goal.title, progress, reachedTier),
          }
        }
      }
    }

    setState({ user: { ...state.user, goals }, days: nextDays })
    if (celebration) setPendingCelebration(celebration)
  }

  return (
    <AppStateContext.Provider
      value={{
        state,
        setState,
        replaceState,
        needsOnboarding,
        toggleDayTask,
        pendingCelebration,
        dismissCelebration: () => setPendingCelebration(null),
      }}
    >
      {children}
    </AppStateContext.Provider>
  )
}
