import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import { formatShortDate } from '../../domain/calendar'
import { TIER_LABEL } from '../../domain/milestones'
import type { Trophy } from '../../domain/profile'
import type { Tier } from '../../domain/models'

/** Fixed per tier, like the day colours: a trophy that changed hue between screens is a different trophy. */
const TIER_COLOR: Record<Tier, string> = {
  none: 'var(--ink-400)',
  bronze: 'var(--rust-500)',
  gold: 'var(--color-day-gold)',
  platinum: 'var(--ink-100)',
}

interface TrophyShelfProps {
  trophies: Trophy[]
}

/**
 * Milestones as a shelf. Tapping one takes the road to the day it was reached, because that is
 * where it actually is: the trophy is a mark on a day, not a badge kept beside the history.
 */
export default function TrophyShelf({ trophies }: TrophyShelfProps) {
  const navigate = useNavigate()

  if (trophies.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex h-[76px] flex-1 items-center justify-center rounded-[20px] border border-border"
              style={{ backgroundColor: 'var(--color-surface-sunken)' }}
            >
              <Icon name="lock" size={20} color="var(--ink-400)" />
            </div>
          ))}
        </div>
        <p className="text-[13px] text-text-muted">
          Здесь встанут вехи задач — первая приходит, когда привычка держится достаточно долго.
        </p>
      </div>
    )
  }

  return (
    <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {trophies.map((trophy) => (
        <button
          key={`${trophy.date}-${trophy.taskId}-${trophy.tier}`}
          type="button"
          onClick={() => navigate(`/?day=${trophy.date}`)}
          className="sk-press sk-focus flex w-[112px] shrink-0 flex-col items-center gap-1.5 rounded-[20px] border border-border px-2 py-3"
          style={{ backgroundColor: 'var(--color-surface-raised)' }}
        >
          <Icon name="award" size={30} color={TIER_COLOR[trophy.tier]} />
          <span className="text-[13px] font-bold" style={{ color: TIER_COLOR[trophy.tier] }}>
            {TIER_LABEL[trophy.tier]}
          </span>
          {/* A task removed later leaves the trophy with no name left in the state to show. */}
          <span className="w-full truncate text-center text-[12px] text-text-secondary">
            {trophy.taskTitle ?? 'Задача удалена'}
          </span>
          <span className="text-[11px] text-text-muted">{formatShortDate(trophy.date)}</span>
        </button>
      ))}
    </div>
  )
}
