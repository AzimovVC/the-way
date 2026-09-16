import { useNavigate } from 'react-router-dom'
import { comebackRank, type Comeback } from '../../domain/comeback'
import { dayWord, formatShortDate } from '../../domain/calendar'
import Icon from '../Icon'

/**
 * Returns as a shelf, beside the shelf of ranks.
 *
 * The count here is the only one in the app a flawless history cannot have, and that is the whole
 * reason it is kept: it turns a slump from a hole in the record into the thing that made this
 * number possible. Like a rank, each one sends the road back to the day it happened — the return
 * is a place on the road, not a badge stored next to it.
 */
export default function ComebackShelf({ comebacks }: { comebacks: Comeback[] }) {
  const navigate = useNavigate()

  if (comebacks.length === 0) {
    return (
      <p className="text-[13px] text-text-muted">
        Здесь встанут возвращения — они появляются, когда дорога уходила вниз и снова пошла вверх.
      </p>
    )
  }

  return (
    <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {[...comebacks].reverse().map((comeback) => {
        const rank = comebackRank(comeback.ordinal)
        return (
          <button
            key={comeback.confirmedDate}
            type="button"
            onClick={() => navigate(`/?day=${comeback.confirmedDate}`)}
            className="sk-press sk-focus flex w-[112px] shrink-0 flex-col items-center gap-1.5 rounded-[20px] border border-border px-2 py-3"
            style={{ backgroundColor: 'var(--color-surface-raised)' }}
          >
            <Icon name="trending-up" size={30} color="var(--color-day-green)" />
            <span className="text-[13px] font-bold" style={{ color: 'var(--color-day-green)' }}>
              {rank ?? `${comeback.ordinal}-е`}
            </span>
            <span className="w-full truncate text-center text-[12px] text-text-secondary">
              после {comeback.slumpLength} {dayWord(comeback.slumpLength)}
            </span>
            <span className="text-[11px] text-text-muted">{formatShortDate(comeback.confirmedDate)}</span>
          </button>
        )
      })}
    </div>
  )
}
