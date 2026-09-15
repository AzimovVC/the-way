import type { ColorTier, Day, TaskTemplate } from '../../domain/models'
import { dailyQuestsFor } from '../../domain/quests'
import { taskIconKind } from '../../domain/taskIcon'
import Icon from '../Icon'
import TaskIcon from '../icons/TaskIcon'
import NodePopover, { type PopoverAnchor } from '../NodePopover'

interface DayCardProps {
  day: Day
  allDays: Day[]
  taskTemplates: Map<string, TaskTemplate>
  isToday: boolean
  anchor: PopoverAnchor
  frameWidth: number
  frameHeight: number
  freezesRemaining: number
  onClose: () => void
  onToggleTask: (dayTaskId: string) => void
  onFreeze: () => void
}

const TIER_COLOR: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold)',
  green: 'var(--color-day-green)',
  red: 'var(--color-day-red)',
  gray: 'var(--color-day-gray)',
  rest: 'var(--color-day-rest)',
}

/** Gold, green and red are bright enough to carry ink; the two dark tiers need the light text. */
const TIER_INK: Record<ColorTier, string> = {
  gold: 'var(--ink-950)',
  green: 'var(--ink-950)',
  red: 'var(--ink-950)',
  gray: 'var(--color-text-primary)',
  rest: 'var(--color-text-primary)',
}

export default function DayCard({
  day,
  allDays,
  taskTemplates,
  isToday,
  anchor,
  frameWidth,
  frameHeight,
  freezesRemaining,
  onClose,
  onToggleTask,
  onFreeze,
}: DayCardProps) {
  const quests = dailyQuestsFor(day, allDays)
  // Nothing to protect on a day that asked for nothing — offering a freeze there would sell a
  // credit against a day that was never at risk.
  const canFreeze = !day.frozen && !day.rest && freezesRemaining > 0 && day.completionRate < 1
  const doneCount = day.tasks.filter((t) => t.isDone).length
  const total = day.tasks.length
  const tierColor = TIER_COLOR[day.colorTier]
  const ink = TIER_INK[day.colorTier]

  return (
    <NodePopover anchor={anchor} frameWidth={frameWidth} frameHeight={frameHeight} accent={tierColor} onClose={onClose}>
      {/* The head wears the circle's own colour, so the card is visibly the same object as the dot
          it grew out of — the tail alone would only say *which* circle, not *how that day went*. */}
      <header className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: tierColor }}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="sk-heading truncate text-[19px]" style={{ color: ink }}>
            {isToday ? 'Сегодня' : day.date}
          </span>
          <span className="sk-num text-[13px]" style={{ color: ink, opacity: 0.72 }}>
            {day.rest ? 'Выходной' : `Задача ${doneCount} из ${total}`}
            {day.frozen && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Icon name="moon" size={13} color={ink} />
                заморожен
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="sk-press sk-focus -mr-1 grid size-8 shrink-0 place-items-center rounded-full"
          style={{ color: ink, opacity: 0.7 }}
        >
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="px-4 pb-4 pt-3">
        {/* A planned day off states itself, and states what it costs — nothing. Left as an empty
            list it would read as a day whose tasks were all missed. */}
        {day.rest && (
          <p className="text-[15px] text-text-secondary">
            На этот день ничего не запланировано. Дорога идёт ровно, серия не прервётся.
          </p>
        )}

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
                  className={`sk-focus flex w-full items-center gap-3 rounded-[20px] border border-border bg-surface-raised px-3.5 py-3 text-left ${
                    isToday ? 'sk-press' : 'opacity-60'
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

        {/* What the mark on the circle stands for. The path can only say "something changed
            here"; the name of the task belongs in the one place the day is read in full. */}
        {(day.taskChanges?.length ?? 0) > 0 && (
          <div className="sk-card-nested mt-3 flex flex-col gap-2">
            <p className="sk-eyebrow">Изменения дня</p>
            {day.taskChanges?.map((change) => (
              <div key={`${change.kind}-${change.taskId}`} className="flex items-center gap-2 text-[13px]">
                <Icon
                  name={change.kind === 'added' ? 'plus' : 'minus'}
                  size={14}
                  color={change.kind === 'added' ? 'var(--cobalt-500)' : 'var(--color-text-muted)'}
                />
                <span className="text-text-secondary">
                  {change.kind === 'added' ? 'Добавлена задача' : 'Убрана задача'} «{change.title}»
                </span>
              </div>
            ))}
          </div>
        )}

        {quests.length > 0 && (
          <div className="sk-card-nested mt-3 flex flex-col gap-2">
            <p className="sk-eyebrow">Квесты дня</p>
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
            className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus mt-3"
            style={{ color: 'var(--color-freeze)' }}
          >
            <Icon name="moon" size={16} color="var(--color-freeze)" />
            Заморозить день ({freezesRemaining} ост.)
          </button>
        )}
      </div>
    </NodePopover>
  )
}
