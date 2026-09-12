import { useEffect, useState } from 'react'
import type { Day, TaskTemplate } from '../../domain/models'
import { taskIconKind } from '../../domain/taskIcon'
import TaskIcon from '../icons/TaskIcon'

interface DayCardProps {
  day: Day
  taskTemplates: Map<string, TaskTemplate>
  isToday: boolean
  anchorX: number
  containerWidth: number
  onClose: () => void
  onToggleTask: (dayTaskId: string) => void
}

const CARD_PADDING = 20

export default function DayCard({
  day,
  taskTemplates,
  isToday,
  anchorX,
  containerWidth,
  onClose,
  onToggleTask,
}: DayCardProps) {
  const [visible, setVisible] = useState(false)

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
          <h3 className="text-base font-semibold text-text-primary">{day.date}</h3>
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
                  {dayTask.isDone && <span className="text-day-green">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
