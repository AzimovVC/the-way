import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AddGoalFlow from '../../components/AddGoalFlow'
import DayCard from '../../components/DayCard'
import PathView from '../../components/PathView'
import type { TaskTemplate } from '../../domain/models'
import { useAppState } from '../../state/AppStateContext'

interface OpenDay {
  dayId: string
  anchorX: number
}

export default function PathScreen() {
  const { state, toggleDayTask } = useAppState()

  const todayDayId = state.days[state.days.length - 1]?.id
  const containerHeight = 640
  const containerWidth = 360

  const taskTemplates = useMemo(() => {
    const map = new Map<string, TaskTemplate>()
    for (const goal of state.user.goals) {
      for (const task of goal.tasks) map.set(task.id, task)
    }
    return map
  }, [state.user.goals])

  const [openDay, setOpenDay] = useState<OpenDay | null>(null)
  const [futureNotice, setFutureNotice] = useState(false)
  const [addingGoal, setAddingGoal] = useState(false)

  const recentTrend = state.days.length > 0 ? state.days[state.days.length - 1].pathAngleDelta : 0
  const primaryGoal = state.user.goals.find((g) => !g.archived)
  const statusText =
    recentTrend >= 0
      ? `Ты двигаешься к цели: ${primaryGoal?.title ?? 'своей цели'} 💪`
      : `Осторожно, ты сползаешь к: ${primaryGoal?.antiGoalTitle ?? 'антицели'} 😴`

  const openDayData = openDay ? state.days.find((d) => d.id === openDay.dayId) : undefined
  const cardIsToday = openDay?.dayId === todayDayId

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="z-10 flex items-center gap-2 px-4 py-3">
        <div className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-text-primary shadow">
          {statusText}
        </div>
        <button
          type="button"
          onClick={() => setAddingGoal(true)}
          aria-label="Добавить цель"
          className="shrink-0 rounded-full border border-border bg-surface px-3 py-3 text-sm text-text-primary shadow"
        >
          +
        </button>
        <Link
          to="/profile"
          aria-label="Профиль"
          className="shrink-0 rounded-full border border-border bg-surface px-3 py-3 text-sm text-text-primary shadow"
        >
          👤
        </Link>
      </header>

      <div
        className="relative flex-1 transition-[filter] duration-300"
        style={{ filter: openDay ? 'grayscale(1) brightness(0.55)' : 'none' }}
      >
        <PathView
          days={state.days}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          todayDayId={todayDayId}
          showMascot
          onDaySelect={(day, screenX) => setOpenDay({ dayId: day.id, anchorX: screenX })}
          onFutureTap={() => setFutureNotice(true)}
        />
      </div>

      {openDay && openDayData && (
        <DayCard
          day={openDayData}
          taskTemplates={taskTemplates}
          isToday={cardIsToday}
          anchorX={openDay.anchorX}
          containerWidth={containerWidth}
          onClose={() => setOpenDay(null)}
          onToggleTask={(dayTaskId) => toggleDayTask(openDay.dayId, dayTaskId)}
        />
      )}

      {futureNotice && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setFutureNotice(false)}
        >
          <div className="w-full max-w-xs rounded-xl border border-border bg-surface p-4 text-center text-text-primary">
            <p className="text-sm text-text-secondary">Этот день ещё не наступил.</p>
          </div>
        </div>
      )}

      {addingGoal && <AddGoalFlow onClose={() => setAddingGoal(false)} />}
    </div>
  )
}
