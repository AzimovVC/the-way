import { useMemo } from 'react'
import AppShell from '../components/AppShell'
import ProfileBackupCard from '../components/ProfileBackupCard'
import ProfileHeader from '../components/ProfileHeader'
import StatTile from '../components/StatTile'
import TrophyShelf from '../components/TrophyShelf'
import { getLogicalToday } from '../domain/pathEngine'
import { collectTrophies, computeProfileOverview } from '../domain/profile'
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
  const trophies = useMemo(() => collectTrophies(state), [state])

  return (
    <AppShell scrollable>
      {/* The banner runs to the frame's edges, so the screen's padding starts under it. */}
      <div className="flex flex-col gap-6 pb-6">
        <ProfileHeader name={state.user.name} startDate={overview.startDate} today={getLogicalToday(new Date())} />

        <div className="flex flex-col gap-6 px-4">
          <section className="flex flex-col gap-3">
            <h2 className="sk-eyebrow">Обзор</h2>
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon="flame" color="var(--color-streak-flame)" value={overview.currentGoldStreak} label="дней подряд" />
              <StatTile icon="check" color="var(--color-day-gold)" value={overview.totalGoldDays} label="золотых дней" />
              <StatTile icon="moon" color="var(--color-freeze)" value={overview.freezesRemaining} label="заморозок" />
              <StatTile icon="flag" color="var(--color-day-green)" value={overview.totalDays} label="дней в пути" />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="sk-eyebrow">Вехи</h2>
            <TrophyShelf trophies={trophies} />
          </section>

          <ProfileBackupCard />
        </div>
      </div>
    </AppShell>
  )
}
