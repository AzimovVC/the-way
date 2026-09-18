import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import ProfileBackupCard from '../components/ProfileBackupCard'
import ProfileHeader from '../components/ProfileHeader'
import StatTile from '../components/StatTile'
import ComebackShelf from '../components/ComebackShelf'
import HabitShowcase from '../components/HabitShowcase'
import Icon from '../components/Icon'
import { getLogicalToday } from '../domain/pathEngine'
import { findComebacks } from '../domain/comeback'
import { dayWord, freezeWord } from '../domain/calendar'
import { handleOf } from '../domain/handle'
import { computeProfileOverview } from '../domain/profile'
import { buildShowcase } from '../domain/showcase'
import { useSocial } from '../social/socialState'
import { useAppState } from '../state/appState'

/**
 * The person, not the plan: goals and tasks live on their own tab, one tap away.
 *
 * A display case rather than a form — the settings moved behind their own route so this screen can
 * be what it is worth opening for. Every number here is derived from the state that already
 * exists; nothing on this screen is a second record of the history.
 */
export default function ProfileScreen() {
  const { state } = useAppState()
  const overview = useMemo(() => computeProfileOverview(state), [state])
  const habits = useMemo(() => buildShowcase(state), [state])
  const comebacks = useMemo(() => findComebacks(state.days), [state.days])
  const { view, loading } = useSocial()

  return (
    <AppShell scrollable>
      {/* The banner runs to the frame's edges, so the screen's padding starts under it. */}
      <div className="flex flex-col gap-6 pb-6">
        <ProfileHeader
          name={state.user.name}
          handle={handleOf(state.user)}
          startDate={overview.startDate}
          today={getLogicalToday(new Date())}
          daysOnRoad={overview.totalDays}
          habitCount={overview.habitCount}
          friendCount={loading ? null : view.friends.length}
        />

        <div className="flex flex-col gap-6 px-4">
          <section className="flex flex-col gap-3">
            <h2 className="sk-eyebrow">Обзор</h2>
            {/* Три числа, а не четыре: «дней в пути» ушло в ряд под именем, где стоит рядом с
                друзьями и привычками — это числа про то, кто это, а не про то, как идут дела.
                Второй раз то же число здесь читалось бы как другой факт. */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <StatTile
                icon="flame"
                color="var(--color-streak-flame)"
                text={`${overview.currentGoldStreak} ${dayWord(overview.currentGoldStreak)} подряд`}
              />
              <StatTile
                icon="check"
                color="var(--color-day-gold)"
                text={
                  overview.totalGoldDays === 1
                    ? '1 золотой день'
                    : `${overview.totalGoldDays} золотых ${dayWord(overview.totalGoldDays)}`
                }
              />
              <StatTile
                icon="moon"
                color="var(--color-freeze)"
                text={`${overview.freezesRemaining} ${freezeWord(overview.freezesRemaining)}`}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            {/* Medals here, and the reading behind them: with four or five habits a full card each
                turned the profile into a list of habits. The row says which habits exist and how
                far each has gone — the days, the rung ahead and the dates live one tap away. */}
            <Link
              to="/profile/habits"
              className="sk-press sk-focus -m-1 flex items-center gap-1 rounded-[12px] p-1"
              aria-label="Все достижения"
            >
              <h2 className="sk-eyebrow flex-1">Достижения</h2>
              {habits.length > 0 && <span className="sk-num text-[12px] text-text-muted">{habits.length}</span>}
              <Icon name="chevron-right" size={16} color="var(--color-text-muted)" />
            </Link>
            <HabitShowcase habits={habits} />
          </section>

          {/* Its own shelf rather than a mixed one: a rank says how long you held, a return says
              you came back, and stacking them in one row would ask the eye to read two different
              claims off the same shape. */}
          <section className="flex flex-col gap-3">
            <h2 className="sk-eyebrow">Возвращения</h2>
            <ComebackShelf comebacks={comebacks} />
          </section>

          <ProfileBackupCard />
        </div>
      </div>
    </AppShell>
  )
}
