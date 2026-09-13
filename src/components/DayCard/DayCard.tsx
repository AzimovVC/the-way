import { useEffect, useMemo, useState } from 'react'
import type { ColorTier, Day, TaskTemplate } from '../../domain/models'
import { dailyQuestsFor } from '../../domain/quests'
import { taskIconKind } from '../../domain/taskIcon'
import Icon from '../Icon'
import TaskIcon from '../icons/TaskIcon'
import { describeArc, ringSegmentAngles } from '../ringSegments'

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

const BADGE_SIZE = 76
const BADGE_RADIUS = BADGE_SIZE / 2
const RING_RADIUS = 34
const RING_GAP_DEG = 14
const RING_STROKE = 6

const TIER_COLOR: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold)',
  green: 'var(--color-day-green)',
  red: 'var(--color-day-red)',
  gray: 'var(--color-day-gray)',
}

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
  const doneCount = day.tasks.filter((t) => t.isDone).length
  const total = day.tasks.length
  const tierColor = TIER_COLOR[day.colorTier]

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const badgeX = Math.min(containerWidth - BADGE_RADIUS - 8, Math.max(BADGE_RADIUS + 8, anchorX))

  const segments = useMemo(() => {
    const angles = ringSegmentAngles(total, RING_GAP_DEG)
    return day.tasks.map((t, i) => ({
      d: describeArc(BADGE_RADIUS, BADGE_RADIUS, RING_RADIUS, angles[i].start, angles[i].end),
      done: t.isDone,
    }))
  }, [day.tasks, total])

  return (
    <div className="absolute inset-0 z-30" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-border bg-surface px-5 pb-7 pt-6 shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute flex flex-col items-center"
          style={{ left: badgeX - BADGE_RADIUS, top: -(BADGE_SIZE - 10) }}
        >
          <div className="relative" style={{ width: BADGE_SIZE, height: BADGE_SIZE }}>
            <svg width={BADGE_SIZE} height={BADGE_SIZE} className="absolute inset-0">
              {segments.map((seg, i) => (
                <path
                  key={i}
                  d={seg.d}
                  stroke={seg.done ? tierColor : 'var(--color-surface-track)'}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  fill="none"
                />
              ))}
            </svg>
            <div
              className="absolute grid place-items-center rounded-full"
              style={{ inset: 10, backgroundColor: tierColor }}
            >
              <Icon name="flame" size={26} color="var(--color-text-on-brand)" />
            </div>
          </div>
          <div
            className="mt-1 h-0 w-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `8px solid ${tierColor}`,
            }}
          />
        </div>

        <header className="mb-1 flex items-start gap-4">
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-display text-lg font-semibold text-text-primary">
              {isToday ? 'Сегодня' : day.date}
            </span>
            <span className="sk-num text-sm text-text-secondary">
              Задача {doneCount} из {total}
              {day.frozen && (
                <span className="ml-2 inline-flex items-center gap-1" style={{ color: 'var(--color-freeze)' }}>
                  <Icon name="moon" size={13} />
                  заморожен
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid size-9 shrink-0 place-items-center rounded-full text-text-secondary transition-transform active:scale-95"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <ul className="mt-4 flex flex-col gap-2">
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
                  className={`flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-raised px-3.5 py-3 text-left transition-transform ${
                    isToday ? 'active:scale-[0.98]' : 'opacity-60'
                  }`}
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-[8px] transition-colors"
                    style={{
                      backgroundColor: dayTask.isDone ? 'var(--color-day-gold)' : 'var(--color-surface-sunken)',
                      boxShadow: dayTask.isDone
                        ? '0 2px 0 var(--marigold-700)'
                        : 'inset 0 0 0 2px var(--color-border)',
                    }}
                  >
                    {dayTask.isDone && <Icon name="check" size={16} color="var(--color-text-on-brand)" />}
                  </span>
                  <TaskIcon kind={kind} className="h-5 w-5 shrink-0 text-text-secondary" />
                  <span
                    className={`flex-1 text-[15px] ${dayTask.isDone ? 'text-text-muted line-through' : 'text-text-primary'}`}
                  >
                    {title}
                  </span>
                  {template && template.habitLevel > 0 && (
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] text-text-muted">
                      ур. {template.habitLevel}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {quests.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-border bg-surface-raised p-3.5">
            <p className="text-[11px] font-bold uppercase text-text-muted" style={{ letterSpacing: '0.09em' }}>
              Квесты дня
            </p>
            {quests.map((q) => (
              <div key={q.id} className="flex items-center gap-2 text-[13px]">
                <Icon
                  name="check"
                  size={14}
                  color={q.isComplete ? 'var(--color-day-green)' : 'var(--color-text-muted)'}
                />
                <span className={q.isComplete ? 'text-text-primary' : 'text-text-secondary'}>{q.text}</span>
              </div>
            ))}
          </div>
        )}

        {canFreeze && (
          <button
            type="button"
            onClick={onFreeze}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-3 py-2.5 font-display text-sm font-semibold text-text-primary transition-transform active:scale-[0.98]"
            style={{ color: 'var(--color-freeze)' }}
          >
            <Icon name="moon" size={16} color="var(--color-freeze)" />
            Заморозить день ({freezesRemaining} ост.)
          </button>
        )}
      </div>
    </div>
  )
}
