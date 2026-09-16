import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import RankBadge from '../RankBadge'
import type { ShowcaseHabit } from '../../domain/showcase'

/**
 * The shelf of habits in the profile — medals in a row, and nothing else.
 *
 * It used to print a full card per habit: name, rank, a progress bar, a line of dated marks. That
 * is the right amount of detail to read once, and the wrong amount to scroll past every time —
 * with four or five habits the profile became a list of habits with a person somewhere above it.
 * So the detail moved to its own screen (`/profile/habits`), and what stays here is the one thing
 * worth seeing without asking: which habits exist and how far each has gone, said in colour.
 *
 * Nothing is greyed out for not having happened yet; a habit before its first rank shows an
 * outline, not a lesser medal.
 */
const PREVIEW_COUNT = 4

export default function HabitShowcase({ habits }: { habits: ShowcaseHabit[] }) {
  const navigate = useNavigate()

  if (habits.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="flex h-[76px] items-center justify-center rounded-[20px] border border-border"
          style={{ backgroundColor: 'var(--color-surface-sunken)' }}
          aria-hidden
        >
          <Icon name="lock" size={20} color="var(--ink-400)" />
        </div>
        <p className="text-[13px] text-text-muted">
          Здесь встанет каждая твоя привычка со своим рангом. Первый ранг приходит через семь дней.
        </p>
      </div>
    )
  }

  const shown = habits.slice(0, PREVIEW_COUNT)
  const rest = habits.length - shown.length

  return (
    // A fixed four-column grid, not a row that stretches: with two habits a stretching row spreads
    // them to the edges and the shelf reads as a layout rather than as a shelf.
    <div className="grid grid-cols-4 gap-2">
      {shown.map((habit) => (
        <button
          key={habit.taskId}
          type="button"
          onClick={() => navigate(`/profile/habits?open=${habit.taskId}`)}
          className="sk-press sk-focus flex min-w-0 flex-col items-center gap-2 rounded-[16px] p-1"
        >
          <RankBadge
            rank={habit.rank?.id ?? null}
            days={habit.daysWalked}
            letter={habit.title.trim().slice(0, 1).toUpperCase()}
            dimmed={habit.status === 'finished'}
          />
          <span className="w-full truncate text-center text-[11px] text-text-muted">{habit.title}</span>
        </button>
      ))}

      {/* The overflow is a count, not a fifth medal: a medal that stands for «и ещё три» would be
          read as a habit. */}
      {rest > 0 && (
        <button
          type="button"
          onClick={() => navigate('/profile/habits')}
          className="sk-press sk-focus flex min-w-0 flex-col items-center gap-2 rounded-[16px] p-1"
        >
          <span
            className="sk-num grid size-[56px] place-items-center rounded-full border border-border text-[15px] font-bold text-text-secondary"
            style={{ backgroundColor: 'var(--color-surface-raised)' }}
          >
            +{rest}
          </span>
          <span className="w-full truncate text-center text-[11px] text-text-muted">ещё</span>
        </button>
      )}
    </div>
  )
}
