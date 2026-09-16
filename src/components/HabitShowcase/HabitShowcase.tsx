import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import { formatShortDate } from '../../domain/calendar'
import { rankLabel } from '../../domain/ranks'
import type { ShowcaseHabit } from '../../domain/showcase'
import { RANK_COLOR } from '../rankColor'

/**
 * The shelf of habits — one card each, whatever they have taken.
 *
 * It used to be a shelf of ranks, so a habit held for half a year stood on it three times and read
 * as three separate achievements. What a person keeps is the habit; the ranks are moments inside
 * it, and they belong under its own name, in order, with the dates they happened.
 *
 * Nothing here is greyed out for not having happened yet: an empty slot saying «сюда ты не дошёл»
 * is the dark half this app does not have. The card shows what was taken and the one rung ahead.
 */
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
          Здесь встанут твои привычки — каждая со своим рангом. Первый ранг приходит через семь дней.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {habits.map((habit) => (
        <HabitCard
          key={habit.taskId}
          habit={habit}
          onOpen={habit.markDate ? () => navigate(`/?day=${habit.markDate}`) : undefined}
        />
      ))}
    </div>
  )
}

function HabitCard({ habit, onOpen }: { habit: ShowcaseHabit; onOpen?: () => void }) {
  const finished = habit.status === 'finished'
  const color = habit.rank ? RANK_COLOR[habit.rank.id] : 'var(--ink-400)'
  // A finished habit keeps its colour but stops being loud about it: it is a record now, not a
  // thing in progress.
  const toGo = habit.nextRank && habit.daysWalked !== null ? Math.max(0, habit.nextRank.days - habit.daysWalked) : null

  return (
    <div
      className="flex flex-col gap-2.5 rounded-[20px] border border-border p-3.5"
      style={{ backgroundColor: 'var(--color-surface-raised)', opacity: finished ? 0.75 : 1 }}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: habit.rank ? color : 'transparent', border: habit.rank ? 'none' : '2px dashed var(--ink-500)' }}
        >
          {habit.rank ? <Icon name="award" size={22} color="var(--ink-950)" /> : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold text-text-primary">{habit.title}</span>
          <span className="truncate text-[12px] text-text-muted">
            {habit.rank ? rankLabel(habit.rank) : 'Первый ранг впереди'}
            {habit.goalTitle ? ` · ${habit.goalTitle}` : ''}
          </span>
        </div>

        <span className="sk-num shrink-0 text-[13px] text-text-secondary">
          {finished ? `завершена ${formatShortDate(habit.finishedOn!)}` : `${habit.daysWalked} дн.`}
        </span>
      </div>

      {/* One thin bar, and only while there is something to walk to. A finished habit has no
          «осталось» — it ended where it ended, and a bar under it would ask for more. */}
      {!finished && habit.nextRank && habit.daysWalked !== null && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-track">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (habit.daysWalked / habit.nextRank.days) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <p className="text-[12px] text-text-muted">
            До «{rankLabel(habit.nextRank)}» — ещё <span className="sk-num">{toGo}</span> дн.
            {habit.targetDays !== null && !habit.targetReached
              ? ` · своя цель ${habit.targetDays} дн.`
              : ''}
          </p>
        </div>
      )}

      {/* The ranks this habit has taken, in the order they happened, each with its day. Tapping the
          card goes to the last of them on the road — that is where it actually is. */}
      {habit.history.length > 0 && (
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          className="sk-press sk-focus -m-1 flex flex-wrap items-center gap-1.5 rounded-xl p-1 text-left"
        >
          {habit.history.map((mark) => (
            <span
              key={`${mark.date}-${mark.days}`}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
              style={{ backgroundColor: 'var(--color-surface-sunken)', color: RANK_COLOR[mark.rank] }}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: RANK_COLOR[mark.rank] }} />
              {mark.days} дн. · {formatShortDate(mark.date)}
            </span>
          ))}
        </button>
      )}
    </div>
  )
}
