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
  minus: 'M5 12h14',
  // Коробка с галочкой — знак сделанного дела. Голая галочка тут не годится: ею уже помечен
  // полностью закрытый день на лице круга, и два одинаковых знака на одном круге читались бы
  // как один и тот же факт, сказанный дважды.
  'box-check': 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8.5 12l2.4 2.4 4.6-5',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  'chevron-left': 'm15 18-6-6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  'chevron-down': 'm6 9 6 6 6-6',
} as const

/** Glyphs that need more than one stroke but no non-path shape. */
const MULTI_PATH = {
  house: [
    'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
    'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  ],
  'chart-column': ['M3 3v16a2 2 0 0 0 2 2h16', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  'list-checks': ['m3 17 2 2 4-4', 'm3 7 2 2 4-4', 'M13 6h8', 'M13 12h8', 'M13 18h8'],
  'trending-up': ['M16 7h6v6', 'm22 7-8.5 8.5-5-5L2 17'],
  'trending-down': ['M16 17h6v-6', 'm22 17-8.5-8.5-5 5L2 7'],
  'arrow-up': ['m5 12 7-7 7 7', 'M12 19V5'],
  'arrow-down': ['M12 5v14', 'm19 12-7 7-7-7'],
  // Ручка перетаскивания. Две линии, а не шесть точек: на 16px точки сливаются в серое пятно,
  // а пятно не говорит «меня можно взять».
  grip: ['M5 9h14', 'M5 15h14'],
  // A heart inside a speech bubble: the road saying what happened, which is what the feed is. The
  // bubble alone reads as messages, and the app has nobody to message.
  'message-heart': [
    'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z',
    'M14.6 8.4a1.7 1.7 0 0 0-2.6.3 1.7 1.7 0 0 0-2.6-.3 1.9 1.9 0 0 0 0 2.6L12 14l2.6-3a1.9 1.9 0 0 0 0-2.6z',
  ],
} as const

export type IconName = keyof typeof SINGLE_PATH | keyof typeof MULTI_PATH | 'award' | 'user' | 'lock' | 'x' | 'settings'

/** Raw path data, for callers (like an SVG-based path renderer) that need to inline a glyph as a `<path>` rather than mount a nested `<svg>`. */
export const ICON_PATH_D = SINGLE_PATH
export const AWARD_PATH_D = 'm15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526'
export const LOCK_PATH_D = 'M7 11V7a5 5 0 0 1 10 0v4'
/**
 * A cup on a plinth, at Lucide's 24px box. Deliberately not the medal `award` wears: that one is
 * already spoken for by a habit's rank — a thing one task earns — and these mark the road itself.
 */
export const TROPHY_PATH_D =
  'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0z'

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

  if (name === 'settings') {
    return (
      <svg {...shared}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
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

  if (name in MULTI_PATH) {
    return (
      <svg {...shared}>
        {MULTI_PATH[name as keyof typeof MULTI_PATH].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    )
  }

  return (
    <svg {...shared}>
      <path d={SINGLE_PATH[name as keyof typeof SINGLE_PATH]} />
    </svg>
  )
}
