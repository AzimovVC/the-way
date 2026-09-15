import Icon from '../Icon'
import { dayWord, daysBetween, formatLongDate } from '../../domain/calendar'

interface ProfileHeaderProps {
  name: string
  /** First day the road holds, or null before there is one. */
  startDate: string | null
  today: string
}

/**
 * The person, as a plaque rather than a form. It is violet because violet is the profile's colour
 * in the tab bar, and a screen whose header disagreed with the tab that opened it would read as a
 * different place.
 */
export default function ProfileHeader({ name, startDate, today }: ProfileHeaderProps) {
  const age = startDate === null ? null : daysBetween(startDate, today) + 1

  return (
    <section
      className="flex items-center gap-4 rounded-[20px] px-4 py-5"
      style={{ backgroundColor: 'var(--violet-700)', boxShadow: '0 6px 0 var(--violet-800)' }}
    >
      {/* A placeholder on purpose: the avatar this app wants is a crop of the person's own road,
          which is the path renderer's job and not this screen's. Until then, the glyph. */}
      <div
        className="flex size-[72px] shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--violet-800)' }}
        aria-hidden
      >
        <Icon name="user" size={38} color="var(--violet-500)" />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="sk-heading truncate text-[26px] text-text-primary">{name.trim() || 'Без имени'}</h1>
        {startDate !== null && age !== null && (
          <p className="text-[13px]" style={{ color: 'var(--ink-100)' }}>
            В пути с {formatLongDate(startDate)} — {age} {dayWord(age)}
          </p>
        )}
      </div>
    </section>
  )
}
