import { useEffect, useState } from 'react'
import { taskIconKind } from '../../domain/taskIcon'
import { WEEKDAY_LABELS, weekdayIndex } from '../../domain/schedule'
import type { TomorrowPlan } from '../../domain/todayBrief'
import Icon from '../Icon'
import TaskIcon from '../icons/TaskIcon'

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

/** «Пн, 16 сентября» — the date in the form a person reads, not the YYYY-MM-DD the state stores. */
function readableDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${WEEKDAY_LABELS[weekdayIndex(date)]}, ${d} ${MONTHS[m - 1]}`
}

/**
 * What tomorrow will ask for — read-only on purpose.
 *
 * There is nothing to tick here: a task cannot be done a day early, and offering a checkbox would
 * invite exactly that. The sheet answers a question and closes.
 */
export default function TomorrowSheet({ plan, onClose }: { plan: TomorrowPlan; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="absolute inset-0 z-30" onClick={onClose}>
      <div
        className="sk-sheet absolute inset-x-0 bottom-0 px-5 pb-7 pt-6"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform var(--dur-slow) var(--ease-out)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-start gap-4">
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="sk-heading text-[19px] text-text-primary">Завтра</span>
            <span className="text-sm text-text-secondary">{readableDate(plan.date)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="sk-press sk-focus grid size-9 shrink-0 place-items-center rounded-full text-text-secondary"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        {plan.titles.length === 0 ? (
          // A day nothing falls on is a rest day, and the road owes nothing on it — so it is
          // announced as one, not drawn as an empty list.
          <div className="sk-card-nested flex items-center gap-3">
            <Icon name="moon" size={20} color="var(--color-day-rest)" />
            <div className="flex flex-col">
              <span className="text-[15px] text-text-primary">Выходной</span>
              <span className="text-[13px] text-text-muted">Дорога идёт ровно, серия не рвётся.</span>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {plan.titles.map((title, i) => (
              <li key={`${title}-${i}`} className="sk-card-nested flex items-center gap-3">
                <TaskIcon kind={taskIconKind(title)} className="size-6 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[15px] text-text-primary">{title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
