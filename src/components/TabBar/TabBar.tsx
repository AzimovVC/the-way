import { NavLink } from 'react-router-dom'
import Icon, { type IconName } from '../Icon'

/**
 * The bar's height, exported because overlays have to keep clear of it: the bar is present on
 * every screen they open on, and an overlay laid out against the frame would otherwise end up
 * under it. Kept here, with the bar itself, so the two cannot drift apart.
 */
export const TAB_BAR_HEIGHT = 72

interface Tab {
  to: string
  icon: IconName
  label: string
  color: string
}

/**
 * Fixed glyph navigation, present on every tab-level screen and absent from
 * pushed ones. Each tab keeps its own colour so the bar is readable by hue
 * alone; the selected tab is marked by a 2px inset ring in that colour rather
 * than a fill, which is reserved for commit actions.
 */
const TABS: Tab[] = [
  { to: '/', icon: 'house', label: 'Путь', color: 'var(--color-brand)' },
  { to: '/tasks', icon: 'list-checks', label: 'Задачи', color: 'var(--cobalt-500)' },
  { to: '/feed', icon: 'message-heart', label: 'Лента', color: 'var(--coral-500)' },
  { to: '/stats', icon: 'chart-column', label: 'Статистика', color: 'var(--color-day-green)' },
  { to: '/profile', icon: 'user', label: 'Профиль', color: 'var(--color-freeze)' },
]

export default function TabBar() {
  return (
    <nav
      className="flex shrink-0 items-stretch gap-1 border-t border-border bg-surface px-2 pb-1 pt-1.5"
      style={{ height: TAB_BAR_HEIGHT }}
      aria-label="Основная навигация"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className="sk-press sk-focus flex flex-1 flex-col items-center justify-center gap-1 rounded-[16px]"
          style={({ isActive }) => ({
            color: isActive ? tab.color : 'var(--color-text-muted)',
            boxShadow: isActive ? `inset 0 0 0 2px ${tab.color}` : 'none',
          })}
        >
          {({ isActive }) => (
            <>
              <Icon name={tab.icon} size={26} color={isActive ? tab.color : 'var(--color-text-muted)'} />
              <span className="text-[11px] font-bold" style={{ letterSpacing: '0.04em' }}>
                {tab.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
