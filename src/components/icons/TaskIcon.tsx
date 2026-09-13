import type { TaskIconKind } from '../../domain/taskIcon'

export default function TaskIcon({ kind, className }: { kind: TaskIconKind; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

  switch (kind) {
    case 'dumbbell':
      return (
        <svg {...common}>
          <path
            d="M4 9v6M2 10v4M22 10v4M20 9v6M7 12h10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path
            d="M4 5.5C4 4.67 4.67 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5C20 4.67 19.33 4 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'headphones':
      return (
        <svg {...common}>
          <path
            d="M4 13v-1a8 8 0 0 1 16 0v1M4 13v5a2 2 0 0 0 2 2h1v-7H5a1 1 0 0 0-1 1v-1ZM20 13v5a2 2 0 0 1-2 2h-1v-7h2a1 1 0 0 1 1 1v-1Z"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'coin':
      return (
        <svg {...common}>
          <circle cx={12} cy={12} r={9} />
          <path d="M12 7v10M9.5 9.5c0-1.4 1.1-2.2 2.5-2.2s2.5.8 2.5 2c0 2.5-5 1.7-5 4.2 0 1.2 1.1 2 2.5 2s2.5-.8 2.5-2" strokeLinecap="round" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...common}>
          <rect x={7} y={2} width={10} height={20} rx={2} />
          <path d="M11 18h2" strokeLinecap="round" />
        </svg>
      )
    case 'sleep':
      return (
        <svg {...common}>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx={12} cy={12} r={10} />
          <circle cx={12} cy={12} r={1} />
        </svg>
      )
  }
}
