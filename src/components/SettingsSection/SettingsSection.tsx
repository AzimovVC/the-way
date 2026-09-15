import type { ReactNode } from 'react'

export interface SettingsSectionProps {
  title: string
  children: ReactNode
  /** A line under the card, where Duolingo would put nothing — the app's own rule: the caveat stays on screen. */
  note?: string
}

/**
 * A titled group of rows. The title stands outside the card rather than inside it, so the card
 * itself is only the list: scanning a settings screen is reading the titles, and a heading
 * boxed in with its rows reads as one more row.
 */
export default function SettingsSection({ title, children, note }: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="sk-eyebrow px-1">{title}</h2>
      <div className="sk-card overflow-hidden" style={{ padding: 0 }}>
        <div className="flex flex-col divide-y divide-border">{children}</div>
      </div>
      {note && <p className="px-1 text-[12px] text-text-muted">{note}</p>}
    </section>
  )
}
