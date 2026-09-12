import { useEffect, useState } from 'react'
import type { Day, TaskTemplate } from '../../domain/models'
import { dailyQuestsFor } from '../../domain/quests'
import { taskIconKind } from '../../domain/taskIcon'
import TaskIcon from '../icons/TaskIcon'

interface DayCardProps {
  day: Day
  allDays: Day[]
  taskTemplates: Map<string, TaskTemplate>
  isToday: boolean
  anchorX: number
  containerWidth: number
  freezesRemaining: number
  onClose: () => void
  onToggleTask: (dayTaskId: string) => void
  onFreeze: () => void
}

const CARD_PADDING = 20

export default function DayCard({
  day,
  allDays,
  taskTemplates,
  isToday,
  anchorX,
  containerWidth,
  freezesRemaining,
  onClose,
  onToggleTask,
  onFreeze,
}: DayCardProps) {
  const [visible, setVisible] = useState(false)
  const quests = dailyQuestsFor(day, allDays)
  const canFreeze = !day.frozen && freezesRemaining > 0 && day.completionRate < 1

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const pointerX = Math.min(containerWidth - CARD_PADDING, Math.max(CARD_PADDING, anchorX))

  return (
    <div className="fixed inset-0 z-30" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface px-4 pb-6 pt-5 shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute -top-2.5 h-5 w-5 rotate-45 border-l border-t border-border bg-surface"
          style={{ left: pointerX - 10 }}
        />

        <header className="mb-3 flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-text-primary">
            {day.date} {day.frozen && '❄️'}
          </h3>
          <span className="text-xs text-text-secondary">{isToday ? 'Сегодня' : 'Прошедший день'}</span>
        </header>

        <ul className="flex flex-col gap-2">
          {day.tasks.map((dayTask) => {
            const template = taskTemplates.get(dayTask.taskTemplateId)
            const title = template?.title ?? 'Задача'
            const kind = taskIconKind(title)

            return (
              <li key={dayTask.id}>
                <button
                  type="button"
                  disabled={!isToday}
                  onClick={() => onToggleTask(dayTask.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    dayTask.isDone
                      ? 'border-day-green bg-day-green/15 text-text-primary'
                      : 'border-border text-text-secondary'
                  } ${isToday ? 'active:scale-[0.98]' : 'opacity-70'}`}
                >
                  <TaskIcon kind={kind} className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-sm">{title}</span>
                  {template && template.habitLevel > 0 && (
                    <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] text-text-secondary">
                      ур. {template.habitLevel}
                    </span>
                  )}
                  {dayTask.isDone && <span className="text-day-green">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>

        {quests.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-border/60 p-3">
            <p className="text-xs font-medium text-text-secondary">Квесты дня</p>
            {quests.map((q) => (
              <div key={q.id} className="flex items-center gap-2 text-xs text-text-secondary">
                <span>{q.isComplete ? '✅' : '⬜️'}</span>
                <span className={q.isComplete ? 'text-text-primary' : ''}>{q.text}</span>
              </div>
            ))}
          </div>
        )}

        {canFreeze && (
          <button
            type="button"
            onClick={onFreeze}
            className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary"
          >
            ❄️ Заморозить этот день ({freezesRemaining} ост.)
          </button>
        )}
      </div>
    </div>
  )
}
