import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../Icon'

export interface SettingsRowProps {
  label: string
  /** One short line under the label. Not a place for caveats — those belong next to the number they qualify. */
  hint?: string
  icon?: IconName
  iconColor?: string
  /** The control on the right: a switch, a value, anything. Ignored for `to` rows, which own their chevron. */
  right?: ReactNode
  to?: string
  onClick?: () => void
  /**
   * A row that is drawn but not yet wired. Its control still shows — the switch is the thing a
   * person recognises a settings row by — but it is dimmed, dead to the touch and labelled. A
   * настройка that
   * silently does nothing is worse than no setting at all — the person changes it and then
   * believes the app behaves differently.
   */
  soon?: boolean
}

/** One line of a settings list: label on the left, whatever acts on it on the right. */
export default function SettingsRow({ label, hint, icon, iconColor, right, to, onClick, soon = false }: SettingsRowProps) {
  const body = (
    <>
      {icon && <Icon name={icon} size={20} color={iconColor ?? 'var(--color-text-muted)'} />}
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="truncate text-[15px] font-medium text-text-primary">{label}</span>
        {hint && <span className="text-[12px] text-text-muted">{hint}</span>}
      </span>
      <span className={`ml-auto flex shrink-0 items-center gap-2 ${soon ? 'pointer-events-none' : ''}`}>
        {soon && <span className="sk-eyebrow" style={{ color: 'var(--ink-400)' }}>скоро</span>}
        {right}
        {to && <Icon name="chevron-right" size={20} color="var(--color-text-muted)" />}
      </span>
    </>
  )

  const shared = 'flex min-h-[56px] w-full items-center gap-3 px-4 py-3'

  if (soon) return <div className={shared} style={{ opacity: 0.5 }}>{body}</div>
  if (to) return <Link to={to} className={`${shared} sk-press sk-focus`}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={`${shared} sk-press sk-focus`}>{body}</button>
  return <div className={shared}>{body}</div>
}
