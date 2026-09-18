import { formatShortDate, nextDay } from '../../domain/calendar'
import type { Chore } from '../../domain/chores'
import Icon from '../Icon'
import HabitGlyph from '../icons/HabitGlyph'

export interface ChoreListProps {
  chores: Chore[]
  today: string
  onToggle: (choreId: string) => void
  onRemove: (choreId: string) => void
}

/**
 * Разовые дела в карточке дня.
 *
 * Стоят **под** привычками и отделены заголовком, потому что считаются они иначе — вернее, не
 * считаются вовсе: «Задача 0 из 2» в шапке дня их не видит, и дорога тоже. Заголовок здесь и есть
 * граница между тем, по чему день судят, и тем, что человек просто держал в голове.
 *
 * Своей кнопки «+ Дело» у списка нет: заводят и привычку, и дело одной кнопкой «+», и вопрос
 * «что добавим» задаётся один раз на оба. Список только показывает и вычёркивает.
 */
export default function ChoreList({ chores, today, onToggle, onRemove }: ChoreListProps) {
  if (chores.length === 0) return null

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="sk-eyebrow">Дела</p>

      {chores.map((chore) => {
        const done = chore.doneOn !== null
        // День называется только если он не сегодняшний: «с 14 сен» на деле, заведённом час
        // назад, — это шум. Прошлое читается как «с такого-то» и это не «просрочено»: счёта тут
        // нет. Будущее называется, потому что вкладка привычек показывает и его: дело, стоящее
        // на субботу, иначе неотличимо от сегодняшнего.
        const when = done || chore.date === today
          ? null
          : chore.date < today
            ? `с ${formatShortDate(chore.date)}`
            : chore.date === nextDay(today)
              ? 'завтра'
              : formatShortDate(chore.date)

        return (
          <div
            key={chore.id}
            className="flex items-center gap-1 rounded-[16px] border border-border bg-surface-raised"
          >
            <button
              type="button"
              onClick={() => onToggle(chore.id)}
              className="sk-press sk-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-[16px] py-2.5 pl-3 text-left"
            >
              <span
                className="grid size-6 shrink-0 place-items-center rounded-[7px] transition-colors"
                style={{
                  backgroundColor: done ? 'var(--color-day-green)' : 'var(--color-surface-sunken)',
                  boxShadow: done ? '0 2px 0 var(--color-day-green-plinth)' : 'inset 0 0 0 2px var(--color-border)',
                }}
              >
                {done && <Icon name="check" size={14} color="var(--ink-950)" />}
              </span>
              <HabitGlyph icon={chore.icon} title={chore.title} size={18} />
              <span className="flex flex-col min-w-0 flex-1">
                <span className={`truncate text-[14px] ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                  {chore.title}
                </span>
                {when && <span className="text-[11px] text-text-muted">{when}</span>}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(chore.id)}
              aria-label={`Убрать «${chore.title}»`}
              className="sk-press sk-focus grid w-9 shrink-0 place-items-center self-stretch rounded-r-[16px]"
            >
              <Icon name="x" size={14} color="var(--color-text-muted)" />
            </button>
          </div>
        )
      })}

    </div>
  )
}
