import { taskIconKind } from '../../domain/taskIcon'
import { WEEKDAY_LABELS, weekdayIndex } from '../../domain/schedule'
import type { TomorrowPlan } from '../../domain/todayBrief'
import Icon from '../Icon'
import TaskIcon from '../icons/TaskIcon'
import NodePopover, { type PopoverAnchor } from '../NodePopover'

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
 * invite exactly that. The card answers a question and closes.
 *
 * It opens on the bubble that asked the question, the way a day's card opens on its circle. The
 * head is the grey of an unreached circle rather than any day's tier colour: tomorrow has no
 * result yet, and colouring it green or gold would state one.
 */
export default function TomorrowPopover({
  plan,
  anchor,
  frameWidth,
  frameHeight,
  onClose,
}: {
  plan: TomorrowPlan
  anchor: PopoverAnchor
  frameWidth: number
  frameHeight: number
  onClose: () => void
}) {
  return (
    <NodePopover
      anchor={anchor}
      frameWidth={frameWidth}
      frameHeight={frameHeight}
      accent="var(--color-day-gray)"
      onClose={onClose}
    >
      <header className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-day-gray)' }}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="sk-heading text-[19px] text-text-primary">Завтра</span>
          <span className="truncate text-[13px] text-text-secondary">{readableDate(plan.date)}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="sk-press sk-focus -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-text-secondary"
        >
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="px-4 pb-4 pt-3">
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
    </NodePopover>
  )
}
