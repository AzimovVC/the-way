import { Link } from 'react-router-dom'
import Icon from '../Icon'
import { dayWord, daysBetween, formatLongDate } from '../../domain/calendar'

interface ProfileHeaderProps {
  name: string
  /** First day the road holds, or null before there is one. */
  startDate: string | null
  today: string
}

/**
 * The person, as a banner rather than a form. It runs to the frame's edges because it is the top
 * of the screen and not a card on it, and it is violet because violet is the profile's colour in
 * the tab bar — a screen whose header disagreed with the tab that opened it would read as a
 * different place.
 */
export default function ProfileHeader({ name, startDate, today }: ProfileHeaderProps) {
  const age = startDate === null ? null : daysBetween(startDate, today) + 1

  return (
    <header className="flex flex-col">
      <div
        className="flex flex-col items-center gap-5 px-4 pb-7 pt-5"
        style={{ backgroundColor: 'var(--violet-700)' }}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <h1 className="sk-heading min-w-0 truncate text-[28px] text-text-primary">
            {name.trim() || 'Без имени'}
          </h1>
          <Link
            to="/profile/settings"
            aria-label="Настройки"
            className="sk-press sk-focus -mr-1 shrink-0 rounded-[16px] p-1"
          >
            <Icon name="settings" size={26} color="var(--ink-100)" />
          </Link>
        </div>

        {/* A circle kept empty on purpose: this is where the picture goes, and the picture this app
            wants is a crop of the person's own road, which is the path renderer's job and not this
            screen's. Until then, the glyph stands in it. */}
        <div
          className="flex size-[132px] items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--violet-800)', boxShadow: 'inset 0 0 0 3px var(--violet-600)' }}
          aria-hidden
        >
          <Icon name="user" size={64} color="var(--violet-500)" />
        </div>
      </div>

      {startDate !== null && age !== null && (
        <p className="sk-eyebrow px-4 pt-5">
          В пути с {formatLongDate(startDate)} · {age} {dayWord(age)}
        </p>
      )}
    </header>
  )
}
