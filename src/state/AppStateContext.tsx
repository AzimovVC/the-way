import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EXP_PER_COMPLETION } from '../domain/config'
import { rollForwardToToday } from '../domain/dayLifecycle'
import { comebackConfirmedOn, type Comeback } from '../domain/comeback'
import { levelFromExp } from '../domain/habitLevel'
import { awardReachedTier } from '../domain/milestoneAward'
import type { AppState } from '../domain/models'
import { applyPathGeometry } from '../domain/pathEngine'
import { reviewDay } from '../domain/review'
import { loadState, saveState } from '../storage/appStorage'
import { markComebackSeen, readComebackSeen } from '../storage/reviewSeen'
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
  const [pendingComeback, setPendingComeback] = useState<Comeback | null>(null)
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

  // A target can be crossed with nothing to hang the screen on: a milestone day is a calendar day,
  // so a Mon–Fri habit finishes its 21st on a Saturday, and a week away arrives already rolled
  // forward on the next start. The award is therefore checked after every change of state as well
  // as on the mark — the card must never sit past its target («35 / 21 дн.») waiting for a tap the
  // schedule is not going to ask for, and the question «дальше или хватит?» is only live at the
  // moment the days run out.
  useEffect(() => {
    if (pendingCelebration) return
    const awarded = awardReachedTier(state)
    if (!awarded) return
    setState(awarded.state)
    setPendingCelebration(awarded.award)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setState is redefined every render
  }, [state, pendingCelebration])

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

    const nextDays = applyPathGeometry(days)

    // The tier the days have already earned, taken here so the screen lands on the tap that earned
    // it. The same call runs from the effect below, which catches the targets crossed without a tap.
    const awarded = awardReachedTier({ user: { ...state.user, goals }, days: nextDays })
    const celebration = awarded?.award ?? null

    // Only the day the road is standing on. A past day filled in afterwards is a repair of the
    // record, and a full-screen celebration for it would be the app congratulating you for
    // Tuesday on Friday.
    //
    // And never behind a tier: that screen is about this same tap, it is the rarer thing, and two
    // full screens in a row for one tick is the app taking the day over. The day loses nothing —
    // it is gold on the road and counted in the streak.
    const isLatestDay = nextDays[nextDays.length - 1]?.id === dayId

    // The road turning back up, called on the day it stopped being in doubt. Behind a tier for the
    // same reason the day's summary is — one tap, one screen — and the comeback loses nothing by
    // waiting: it is read from the shape of the road, so the shelf has it either way.
    let comeback: Comeback | null = null
    if (willBeDone && !celebration && isLatestDay) {
      const found = comebackConfirmedOn(nextDays, day.date)
      if (found && readComebackSeen() !== found.confirmedDate) {
        comeback = found
        markComebackSeen(found.confirmedDate)
      }
    }

    if (willBeDone && !celebration && !comeback && isLatestDay && !reviewedDays.current.has(dayId) && reviewDay(nextDays, dayId)) {
      reviewedDays.current.add(dayId)
      setPendingDayReviewId(dayId)
    }

    setState(awarded?.state ?? { user: { ...state.user, goals }, days: nextDays })
    if (celebration) setPendingCelebration(celebration)
    if (comeback) setPendingComeback(comeback)
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
        pendingComeback,
        dismissComeback: () => setPendingComeback(null),
        pendingDayReviewId,
        dismissDayReview: () => setPendingDayReviewId(null),
      }}
    >
      {children}
    </AppStateContext.Provider>
  )
}
