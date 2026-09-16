import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import RankBadge from '../components/RankBadge'
import { RANK_COLOR } from '../components/rankColor'
import { dayWord, formatShortDate } from '../domain/calendar'
import { rankLabel } from '../domain/ranks'
import { buildShowcase, type ShowcaseHabit } from '../domain/showcase'
import { useAppState } from '../state/appState'

/**
 * The shelf of ranks, given its own screen.
 *
 * Named «Достижения» and not «Привычки», because the tab bar now says «Привычки» and means the
 * place a person edits them. Two screens with one name made the person guess which of them they wanted;
 * this one collects what a habit has already taken, so it says that instead.
 *
 * «Достижения» rather than «Уровни», which it said before: a level is a rung, and this shelf holds
 * habits, not rungs. The word «уровень» keeps its single meaning on the habit card and on the
 * screen that awards one.
 *
 * In the profile it is a row of medals; everything a person reads once — the days walked, the rung
 * ahead, the dates the ranks were taken — lives here, and only while a card is opened. Four habits
 * printed in full made the profile a list of habits; four medals and a screen behind them say the
 * same thing and leave the profile about the person.
 *
 * One card per habit, not one per rank: a habit held for half a year used to stand on the shelf
 * three times and read as three separate achievements. The ranks are moments inside the habit, and
 * they sit in its own card, in order, with the days they happened.
 */
export default function HabitsScreen() {
  const { state } = useAppState()
  const habits = useMemo(() => buildShowcase(state), [state])
  const [params] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get('open'))

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <Link to="/profile" aria-label="Назад в профиль" className="sk-press sk-focus -ml-2 rounded-[16px] p-2">
            <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
          </Link>
          <h1 className="sk-heading text-[32px] text-text-primary">Достижения</h1>
        </div>

        {habits.length === 0 ? (
          <p className="text-[13px] text-text-muted">
            Здесь встанет каждая твоя привычка со своим уровнем. Первый — через семь дней.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {habits.map((habit) => (
              <HabitCard
                key={habit.taskId}
                habit={habit}
                open={openId === habit.taskId}
                onToggle={() => setOpenId(openId === habit.taskId ? null : habit.taskId)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function HabitCard({ habit, open, onToggle }: { habit: ShowcaseHabit; open: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const finished = habit.status === 'finished'
  const color = habit.rank ? RANK_COLOR[habit.rank.id] : 'var(--ink-400)'
  const toGo = habit.nextRank && habit.daysWalked !== null ? Math.max(0, habit.nextRank.days - habit.daysWalked) : null

  return (
    <div
      className="flex flex-col rounded-[20px] border border-border"
      style={{ backgroundColor: 'var(--color-surface-raised)', opacity: finished ? 0.8 : 1 }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="sk-press sk-focus flex items-center gap-3 rounded-[20px] p-3.5 text-left"
      >
        <RankBadge
          rank={habit.rank?.id ?? null}
          size={44}
          letter={habit.title.trim().slice(0, 1).toUpperCase()}
          dimmed={finished}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold text-text-primary">{habit.title}</span>
          <span className="truncate text-[12px]" style={{ color: habit.rank ? color : 'var(--color-text-muted)' }}>
            {habit.rank ? rankLabel(habit.rank) : 'Первый уровень впереди'}
          </span>
        </div>

        <span className="sk-num shrink-0 text-[13px] text-text-secondary">
          {finished ? formatShortDate(habit.finishedOn!) : `${habit.daysWalked} дн.`}
        </span>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} color="var(--color-text-muted)" />
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-3.5 pb-3.5">
          {habit.goalTitle && <p className="text-[12px] text-text-muted">Цель · {habit.goalTitle}</p>}

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
                Дальше «{rankLabel(habit.nextRank)}» — ещё <span className="sk-num">{toGo}</span> {dayWord(toGo!)}.
              </p>
            </div>
          )}

          {finished && (
            <p className="text-[12px] text-text-muted">
              Завершена {formatShortDate(habit.finishedOn!)} — пройденный путь остался на дороге.
            </p>
          )}

          {/* The ranks this habit has taken, in the order they happened. Each one sends the road
              back to its own day: a rank is a place on the road, not a badge kept beside it. */}
          {habit.history.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="sk-eyebrow">Что уже взял</span>
              <div className="flex flex-wrap gap-1.5">
                {habit.history.map((mark) => (
                  <button
                    key={`${mark.date}-${mark.days}`}
                    type="button"
                    onClick={() => navigate(`/?day=${mark.date}`)}
                    className="sk-press sk-focus flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
                    style={{ backgroundColor: 'var(--color-surface-sunken)', color: RANK_COLOR[mark.rank] }}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: RANK_COLOR[mark.rank] }} />
                    {rankLabel({ id: mark.rank, days: mark.days, year: Math.max(1, Math.floor(mark.days / 365)) })} ·{' '}
                    <span className="sk-num">{mark.days}</span> дн. · {formatShortDate(mark.date)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
