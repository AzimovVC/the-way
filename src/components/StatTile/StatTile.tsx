import Icon, { type IconName } from '../Icon'

interface StatTileProps {
  icon: IconName
  /** The metric's own colour — fixed per metric by the tokens, never picked per screen. */
  color: string
  value: number
  label: string
}

/**
 * One number in the overview grid: glyph and numeral share a colour, the label stays neutral
 * underneath. Tabular numerals so four tiles in a grid keep their digits on the same columns.
 */
export default function StatTile({ icon, color, value, label }: StatTileProps) {
  return (
    <div className="sk-card-nested flex items-center gap-3">
      <Icon name={icon} size={24} color={color} />
      <div className="flex min-w-0 flex-col">
        <span className="sk-num text-[22px] font-semibold leading-none" style={{ color }}>
          {value}
        </span>
        <span className="truncate text-[12px] text-text-muted">{label}</span>
      </div>
    </div>
  )
}
