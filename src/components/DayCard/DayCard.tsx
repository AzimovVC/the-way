import { useState } from 'react'
import { formatLongDate } from '../../domain/calendar'
import type { Chore } from '../../domain/chores'
import type { ColorTier, Day, TaskTemplate } from '../../domain/models'
import { ANY_TIME_GROUP, PART_OF_DAY } from '../../domain/partOfDay'
import { WEEKDAY_LABELS, weekdayIndex } from '../../domain/schedule'
import { groupDayTasks } from '../../domain/taskOrder'
import AddGoalFlow from '../AddGoalFlow'
import AddMenu from '../AddMenu'
import ChoreEditorModal, { type ChoreEditorValue } from '../ChoreEditorModal'
import Icon from '../Icon'
import HabitGlyph from '../icons/HabitGlyph'
import ChoreList from '../ChoreList'
import NodePopover, { type PopoverAnchor } from '../NodePopover'

interface DayCardProps {
  day: Day
  taskTemplates: Map<string, TaskTemplate>
  isToday: boolean
  anchor: PopoverAnchor
  frameWidth: number
  frameHeight: number
  freezesRemaining: number
  onClose: () => void
  /** Попросить у дороги места под кругом — см. NodePopover. Есть только там, где дорога есть. */
  requestRoom?: (neededBelowCentre: number, done: () => void) => void
  onToggleTask: (dayTaskId: string) => void
  /** Разовые дела этого дня — они не входят в day.tasks и ни на что в дне не влияют. */
  chores: Chore[]
  today: string
  onAddChore: (value: ChoreEditorValue) => void
  onToggleChore: (choreId: string) => void
  onRemoveChore: (choreId: string) => void
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
  taskTemplates,
  isToday,
  anchor,
  frameWidth,
  frameHeight,
  freezesRemaining,
  onClose,
  requestRoom,
  onToggleTask,
  chores,
  today,
  onAddChore,
  onToggleChore,
  onRemoveChore,
  onFreeze,
}: DayCardProps) {
  // Отрезки дня и порядок внутри них. Заголовки появляются только когда отрезков больше одного:
  // единственный «Когда угодно» над списком из трёх строк — подпись к тому, что и так очевидно.
  const groups = groupDayTasks(day.tasks, taskTemplates)
  const showGroupHeadings = groups.length > 1
  // Nothing to protect on a day that asked for nothing — offering a freeze there would sell a
  // credit against a day that was never at risk.
  const canFreeze = !day.frozen && !day.rest && freezesRemaining > 0 && day.completionRate < 1
  const [confirmFreeze, setConfirmFreeze] = useState(false)
  // Что заводят — привычку или дело — спрашивает AddMenu, тот же, что на вкладке привычек.
  const [adding, setAdding] = useState<'menu' | 'habit' | 'chore' | null>(null)
  const doneCount = day.tasks.filter((t) => t.isDone).length
  const total = day.tasks.length
  const tierColor = TIER_COLOR[day.colorTier]
  const ink = TIER_INK[day.colorTier]

  return (
    <>
    <NodePopover anchor={anchor} frameWidth={frameWidth} frameHeight={frameHeight} accent={tierColor} onClose={onClose} requestRoom={requestRoom}>
      {/* The head wears the circle's own colour, so the card is visibly the same object as the dot
          it grew out of — the tail alone would only say *which* circle, not *how that day went*. */}
      <header className="flex items-start gap-2 px-4 py-3" style={{ backgroundColor: tierColor }}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="sk-heading truncate text-[19px]" style={{ color: ink }}>
            {/* «Ср, 26 августа», not 2026-08-26: the stored form is a key, not something to read. */}
            {isToday ? 'Сегодня' : `${WEEKDAY_LABELS[weekdayIndex(day.date)]}, ${formatLongDate(day.date)}`}
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
        {/* Заморозка стоит на плашке, а не внизу карточки: это не итог чтения дня, а кнопка, за
            которой человек сюда и пришёл, когда пришёл за ней. Внизу она к тому же уезжала под
            дела и изменения дня — тем дальше, чем длиннее был день.

            Тап здесь тратит невозвратное, а рядом стоит «Закрыть», поэтому спрашивается второй
            раз: промах по соседней кнопке не должен стоить заморозки. */}
        {canFreeze && (
          <button
            type="button"
            onClick={() => (confirmFreeze ? onFreeze() : setConfirmFreeze(true))}
            aria-label={`Заморозить день, осталось ${freezesRemaining}`}
            className="sk-press sk-focus flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold"
            style={{ color: ink, boxShadow: `inset 0 0 0 1.5px ${ink}`, opacity: 0.85 }}
          >
            <Icon name="moon" size={15} color={ink} />
            {confirmFreeze ? 'Точно?' : freezesRemaining}
          </button>
        )}
        {/* Одна кнопка на обе вещи, и вопрос за ней тот же, что на вкладке привычек: повторяется
            она или случится один раз. Раньше здесь стояло «+ Дело» — и человек, которому пришла в
            голову привычка, читал это как «привычку отсюда не завести», хотя день — ровно то место,
            где такое приходит в голову.

            Стоит на плашке, а не внизу карточки: внизу она росла вместе со списком и уезжала тем
            дальше, чем больше в дне дел, а «добавить» — это не итог чтения списка. Наверху её место
            не зависит от того, что в дне. */}
        {isToday && (
          <button
            type="button"
            onClick={() => setAdding('menu')}
            aria-label="Добавить"
            className="sk-press sk-focus grid size-8 shrink-0 place-items-center rounded-full"
            style={{ color: ink, boxShadow: `inset 0 0 0 1.5px ${ink}`, opacity: 0.85 }}
          >
            <Icon name="plus" size={17} />
          </button>
        )}
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

        {groups.map((group) => (
          <div key={group.part ?? 'any'} className="flex flex-col gap-2 [&+&]:mt-3">
            {showGroupHeadings && (
              <p className="sk-eyebrow flex items-center gap-1.5">
                {group.part && <span aria-hidden>{PART_OF_DAY[group.part].emoji}</span>}
                {group.part ? PART_OF_DAY[group.part].group : ANY_TIME_GROUP}
              </p>
            )}
            <ul className="flex flex-col gap-2">
          {group.tasks.map((dayTask) => {
            const template = taskTemplates.get(dayTask.taskTemplateId)
            const title = template?.title ?? 'Задача'

            return (
              <li
                key={dayTask.id}
                className="flex items-stretch gap-1 rounded-[20px] border border-border bg-surface-raised"
                style={{ opacity: isToday ? 1 : 0.6 }}
              >
                <button
                  type="button"
                  disabled={!isToday}
                  onClick={() => onToggleTask(dayTask.id)}
                  className={`sk-focus flex min-w-0 flex-1 items-center gap-3 rounded-[20px] px-3.5 py-3 text-left ${
                    isToday ? 'sk-press' : ''
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
                  <HabitGlyph icon={template?.icon} title={title} size={20} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[15px] ${dayTask.isDone ? 'text-text-muted line-through' : 'text-text-primary'}`}
                  >
                    {title}
                  </span>
                </button>
              </li>
            )
          })}
            </ul>
          </div>
        ))}

        {/* Дела стоят под привычками и за своим заголовком: «Задача 0 из 2» в шапке их не считает,
            и дорога не считает тоже. Заголовок — это и есть граница между тем, по чему день судят,
            и тем, что человек просто держал в голове. */}
        <ChoreList chores={chores} today={today} onToggle={onToggleChore} onRemove={onRemoveChore} />

        {/* What the mark on the circle stands for. The path can only say "something changed
            here"; the name of the task belongs in the one place the day is read in full. */}
        {(day.taskChanges?.length ?? 0) > 0 && (
          <div className="sk-card-nested mt-3 flex flex-col gap-2">
            <p className="sk-eyebrow">Изменения дня</p>
            {day.taskChanges?.map((change) => (
              <div key={`${change.kind}-${change.taskId}`} className="flex items-center gap-2 text-[13px]">
                <Icon
                  name={change.kind === 'added' ? 'plus' : change.kind === 'removed' ? 'minus' : 'calendar'}
                  size={14}
                  color={change.kind === 'added' ? 'var(--cobalt-500)' : 'var(--color-text-muted)'}
                />
                <span className="text-text-secondary">
                  {change.kind === 'added'
                    ? 'Добавлена задача'
                    : change.kind === 'removed'
                      ? 'Убрана задача'
                      : 'Изменено расписание'}{' '}
                  «{change.title}»
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </NodePopover>

    {adding === 'menu' && (
      <AddMenu onHabit={() => setAdding('habit')} onChore={() => setAdding('chore')} onCancel={() => setAdding(null)} />
    )}
    {adding === 'habit' && <AddGoalFlow onClose={() => setAdding(null)} />}
    {adding === 'chore' && (
      <ChoreEditorModal
        today={today}
        onSave={(value) => {
          onAddChore(value)
          setAdding(null)
        }}
        onCancel={() => setAdding(null)}
      />
    )}
    </>
  )
}
