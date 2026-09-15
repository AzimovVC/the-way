import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EXP_PER_COMPLETION } from '../domain/config'
import { rollForwardToToday } from '../domain/dayLifecycle'
import { levelFromExp } from '../domain/habitLevel'
import { buildCycleReport, computeMilestoneProgress } from '../domain/milestones'
import type { AppState } from '../domain/models'
import { addDaysISO, applyPathGeometry } from '../domain/pathEngine'
import { reviewDay } from '../domain/review'
import { loadState, saveState } from '../storage/appStorage'
import { AppStateContext, type CelebrationInfo } from './appState'

function localHhMm(at: Date): string {
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

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
  const [pendingDayReviewId, setPendingDayReviewId] = useState<string | null>(null)
  // Days whose summary has already been shown in this session. Unticking the last task and
  // ticking it back is a correction, not a second day closed, and it must not replay the screen.
  const reviewedDays = useRef(new Set<string>())

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
      const now = new Date()
      const tasks = d.tasks.map((t) =>
        t.id === dayTaskId
          ? {
              ...t,
              isDone: willBeDone,
              completedAt: willBeDone ? now.toISOString() : null,
              completedLocal: willBeDone ? localHhMm(now) : undefined,
            }
          : t,
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

    // Only the day the road is standing on. A past day filled in afterwards is a repair of the
    // record, and a full-screen celebration for it would be the app congratulating you for
    // Tuesday on Friday.
    //
    // And never behind a tier: that screen is about this same tap, it is the rarer thing, and two
    // full screens in a row for one tick is the app taking the day over. The day loses nothing —
    // it is gold on the road and counted in the streak.
    const isLatestDay = nextDays[nextDays.length - 1]?.id === dayId
    if (willBeDone && !celebration && isLatestDay && !reviewedDays.current.has(dayId) && reviewDay(nextDays, dayId)) {
      reviewedDays.current.add(dayId)
      setPendingDayReviewId(dayId)
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
        pendingDayReviewId,
        dismissDayReview: () => setPendingDayReviewId(null),
      }}
    >
      {children}
    </AppStateContext.Provider>
  )
}
