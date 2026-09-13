/**
 * Monoline glyphs, inlined from Lucide (ISC) so the app works offline —
 * the design system's own Icon spec renders these as a CDN mask; we bundle
 * the handful this app uses instead of taking a runtime CDN dependency.
 */
const SINGLE_PATH = {
  flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  moon: 'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401',
  flag: 'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528',
  plus: 'M5 12h14ZM12 5v14',
  check: 'M20 6 9 17l-5-5',
} as const

export type IconName = keyof typeof SINGLE_PATH | 'award' | 'user' | 'lock' | 'x'

/** Raw path data, for callers (like an SVG-based path renderer) that need to inline a glyph as a `<path>` rather than mount a nested `<svg>`. */
export const ICON_PATH_D = SINGLE_PATH
export const AWARD_PATH_D = 'm15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526'
export const LOCK_PATH_D = 'M7 11V7a5 5 0 0 1 10 0v4'

export interface IconProps {
  name: IconName
  size?: number
  color?: string
  className?: string
}

export default function Icon({ name, size = 20, color = 'currentColor', className }: IconProps) {
  const shared = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className, 'aria-hidden': true as const }

  if (name === 'award') {
    return (
      <svg {...shared}>
        <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" />
        <circle cx="12" cy="8" r="6" />
      </svg>
    )
  }

  if (name === 'user') {
    return (
      <svg {...shared}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  }

  if (name === 'lock') {
    return (
      <svg {...shared}>
        <rect width={18} height={11} x={3} y={11} rx={2} ry={2} />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    )
  }

  if (name === 'x') {
    return (
      <svg {...shared}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    )
  }

  return (
    <svg {...shared}>
      <path d={SINGLE_PATH[name]} />
    </svg>
  )
}
