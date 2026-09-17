import { useState } from 'react'
import { formatShortDate } from '../../domain/calendar'
import type { Chore } from '../../domain/chores'
import Icon from '../Icon'
import HabitGlyph from '../icons/HabitGlyph'

export interface ChoreListProps {
  chores: Chore[]
  today: string
  /** Добавлять можно только в сегодняшний день: прошлому дню новое дело уже не поставить. */
  canAdd: boolean
  onAdd: (title: string, date: string) => void
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
 * Поле ввода добавляет по Enter и не закрывается после этого: дела пишут пачкой, и список,
 * закрывающий ввод после каждой строки, заставляет тапать «плюс» четыре раза подряд.
 */
export default function ChoreList({ chores, today, canAdd, onAdd, onToggle, onRemove }: ChoreListProps) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  // «Завтра» — единственная дата помимо сегодня, которую стоит спрашивать здесь. Календарь на
  // экране дня отвечал бы на вопрос «когда», которого человек, открывший сегодняшний день, не
  // задавал; всё остальное — это уже планировщик, а не список.
  const [tomorrow, setTomorrow] = useState(false)

  function submit() {
    if (!title.trim()) return
    onAdd(title, tomorrow ? nextDay(today) : today)
    setTitle('')
  }

  if (chores.length === 0 && !canAdd) return null

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="sk-eyebrow">Дела</p>

      {chores.map((chore) => {
        const done = chore.doneOn !== null
        // День, на который дело ставили, называется только если он не сегодняшний: «с 14 сен» на
        // деле, заведённом час назад, — это шум. И это не «просрочено»: счёта тут нет.
        const from = !done && chore.date < today ? formatShortDate(chore.date) : null

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
                {from && <span className="text-[11px] text-text-muted">с {from}</span>}
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

      {canAdd &&
        (adding ? (
          <div className="flex flex-col gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') setAdding(false)
              }}
              placeholder="Что нужно сделать?"
              autoFocus
              className="sk-input"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTomorrow(false)}
                data-selected={!tomorrow}
                className="sk-chip sk-plinth sk-focus sk-btn-sm"
              >
                Сегодня
              </button>
              <button
                type="button"
                onClick={() => setTomorrow(true)}
                data-selected={tomorrow}
                className="sk-chip sk-plinth sk-focus sk-btn-sm"
              >
                Завтра
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!title.trim()}
                className="sk-btn sk-btn-primary sk-btn-sm sk-plinth sk-focus ml-auto"
              >
                Добавить
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
          >
            <Icon name="plus" size={14} />
            Дело
          </button>
        ))}
    </div>
  )
}

/** Следующий календарный день. Дела живут в календаре, а не в логическом дне дороги. */
function nextDay(date: string): string {
  const at = new Date(`${date}T12:00:00Z`)
  at.setUTCDate(at.getUTCDate() + 1)
  return at.toISOString().slice(0, 10)
}
