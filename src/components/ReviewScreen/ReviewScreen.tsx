import type { CSSProperties, ReactNode } from 'react'

/**
 * The shell both summary screens are built on: the road stops, shows what just happened, and
 * hands back one way forward.
 *
 * It takes the whole frame on purpose. These screens appear at the two moments the app has
 * something finished to say, and a card inside the path screen would put the news beside the very
 * road it is about — the person would read the numbers and the drawing at once and believe one of
 * them twice.
 *
 * Two tones, and the tone carries meaning rather than variety: gold is the colour of a day closed
 * in full and nothing else in this app is gold, so the day screen is gold all over. A week is a
 * mixed thing — gold days, ordinary days, days off — and it is shown on the app's own dark ground
 * with the week's real colours inside it.
 */
export type ReviewTone = 'gold' | 'dark'

interface TonePalette {
  bg: string
  text: string
  muted: string
  tileBg: string
  tileBorder: string
  primaryBg: string
  primaryInk: string
  primaryPlinth: string
}

const TONE: Record<ReviewTone, TonePalette> = {
  gold: {
    bg: 'var(--color-day-gold)',
    text: 'var(--ink-950)',
    muted: 'rgba(0,0,0,.6)',
    tileBg: 'var(--ink-950)',
    tileBorder: 'var(--marigold-700)',
    primaryBg: 'var(--ink-950)',
    primaryInk: 'var(--color-day-gold)',
    primaryPlinth: 'var(--marigold-700)',
  },
  dark: {
    bg: 'var(--color-bg)',
    text: 'var(--color-text-primary)',
    muted: 'var(--color-text-muted)',
    tileBg: 'var(--color-surface)',
    tileBorder: 'var(--color-border)',
    primaryBg: 'var(--color-brand)',
    primaryInk: 'var(--color-text-on-brand)',
    primaryPlinth: 'var(--color-brand-plinth)',
  },
}

export interface ReviewTileData {
  label: string
  /** A string, not a number: «5 из 6» is one reading and must not be split into two tiles. */
  value: string
  color: string
  /**
   * The outline, when it should not be the value's own colour. A number that owns a colour wears
   * it on both; a neutral number would otherwise be framed in near-white and shout over the two
   * tiles that actually mean something.
   */
  border?: string
}

interface ReviewScreenProps {
  tone: ReviewTone
  eyebrow: string
  title: string
  /** One sentence under the title. The screen is read once, from a phone — the second sentence goes in `note`. */
  subtitle?: string
  hero: ReactNode
  /**
   * Empty is allowed, and means the news is a sentence rather than numbers. A screen whose only
   * figures would agree with each other — the guess and the days that met it are the same number —
   * is better off saying nothing three times than saying it three times.
   */
  tiles: ReviewTileData[]
  /** The line that qualifies the numbers — a record, a comparison, days that were not counted. */
  note?: string | null
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

export default function ReviewScreen({
  tone,
  eyebrow,
  title,
  subtitle,
  hero,
  tiles,
  note,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: ReviewScreenProps) {
  const palette = TONE[tone]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{ backgroundColor: palette.bg, color: palette.text }}
    >
      <div className="sk-rise flex flex-1 flex-col items-center justify-center gap-5 px-6 py-8 text-center">
        {hero}

        <div className="flex flex-col gap-2">
          <p className="sk-eyebrow" style={{ color: palette.muted }}>
            {eyebrow}
          </p>
          <h1 className="sk-heading text-[30px] leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-[16px]" style={{ color: palette.muted }}>
              {subtitle}
            </p>
          )}
        </div>

        {tiles.length > 0 && (
        <div className="grid w-full max-w-sm grid-cols-3 gap-2.5">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="flex flex-col items-center gap-1.5 rounded-[18px] border-2 px-2 py-3"
              style={{ backgroundColor: palette.tileBg, borderColor: tile.border ?? tile.color }}
            >
              {/* A two-line label must not push its own number down a row: the three values read
                  as one line across the screen, and one of them sitting lower reads as a mistake. */}
              <span
                className="sk-eyebrow flex min-h-[22px] items-center text-center text-[10px] leading-[1.1]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {tile.label}
              </span>
              {/* Three tiles share the width, and «5 из 5» is far wider than «16» — on a 320px
                  phone a fixed 22px would push the value past its own tile. It shrinks with the
                  screen and stops at the size the design asks for. */}
              <span
                className="sk-num leading-none font-semibold whitespace-nowrap"
                style={{ color: tile.color, fontSize: 'clamp(17px, 5.5vw, 22px)' }}
              >
                {tile.value}
              </span>
            </div>
          ))}
        </div>
        )}

        {note && (
          <p className="max-w-sm text-[15px]" style={{ color: palette.muted }}>
            {note}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1 px-5 pb-8">
        <button
          type="button"
          onClick={onPrimary}
          className="sk-btn sk-btn-lg sk-btn-block sk-plinth sk-focus"
          style={
            {
              backgroundColor: palette.primaryBg,
              color: palette.primaryInk,
              '--plinth-color': palette.primaryPlinth,
            } as CSSProperties
          }
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="sk-btn sk-btn-block sk-press sk-focus"
            style={{ color: palette.muted, backgroundColor: 'transparent' }}
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
