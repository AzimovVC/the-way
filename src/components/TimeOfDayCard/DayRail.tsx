import type { HabitWindow, PointOfNoReturn } from '../../domain/timeOfDay'

export interface RailRow {
  taskId: string
  title: string
  window: HabitWindow
  point: PointOfNoReturn | null
  /** Median of the first weeks, when the task has drifted noticeably since. */
  wasMedian: number | null
}

/** The scale every row shares: the logical day, 3:00 to 27:00. */
const HOUR_FROM = 3
const HOUR_TO = 27
const TICKS = [6, 9, 12, 15, 18, 21, 24]

const VIEW_W = 320
const PLOT_L = 6
const PLOT_R = VIEW_W - 6
const AXIS_H = 20
const ROW_LABEL_H = 17
const RAIL_H = 22
const CAPTION_H = 14

const BAND_H = 10
const DOT_R = 4

function x(hour: number): number {
  return PLOT_L + ((hour - HOUR_FROM) / (HOUR_TO - HOUR_FROM)) * (PLOT_R - PLOT_L)
}

function formatHour(hour: number): string {
  const wrapped = hour >= 24 ? hour - 24 : hour
  const h = Math.floor(wrapped)
  const m = Math.round((wrapped - h) * 60)
  return `${h}:${String(m === 60 ? 0 : m).padStart(2, '0')}`
}

/** True when the window is too narrow to hold the median dot inside it. */
function isTight(row: RailRow): boolean {
  return x(row.window.high) - x(row.window.low) < DOT_R * 2 + 4
}

function rowHeight(row: RailRow): number {
  return ROW_LABEL_H + RAIL_H + (row.point ? CAPTION_H : 0)
}

/**
 * Every task on one scale of the day, so the shape of a whole day is one glance rather than five
 * sentences — and so two tasks can be compared, which separate strips would not allow.
 *
 * Colour carries one thing only: the band is when the task happens. The hour after which it stops
 * happening is a boundary, not a second colour — drawn as a neutral rule with a hatched tail,
 * because a coral area beside the teal band sits at ΔE 3.4 under protanopia and would be two
 * indistinguishable fills. It is also the right meaning: the road judges whether a day was done,
 * never when, so nothing here should read as a red mark against you.
 */
export default function DayRail({ rows }: { rows: RailRow[] }) {
  // Row tops are laid out up front rather than accumulated inside the map, so nothing is
  // reassigned while rendering.
  const tops: number[] = []
  let next = AXIS_H
  for (const row of rows) {
    tops.push(next)
    next += rowHeight(row)
  }
  const height = next

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Когда задачи обычно выполняются в течение дня"
    >
      <defs>
        <pattern id="rail-dead" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-500)" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Hairline verticals, one shade off the surface: they are what makes the scale shared. Drawn
          only across the rails — running them through the task names would put a grid behind text. */}
      {rows.map((row, index) =>
        TICKS.map((tick) => (
          <line
            key={`grid-${row.taskId}-${tick}`}
            x1={x(tick)}
            y1={tops[index] + ROW_LABEL_H}
            x2={x(tick)}
            y2={tops[index] + ROW_LABEL_H + RAIL_H}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        )),
      )}

      {TICKS.map((tick) => (
        <text
          key={`tick-${tick}`}
          x={x(tick)}
          y={9}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-text-muted)"
        >
          {tick}
        </text>
      ))}

      {rows.map((row, index) => {
        const top = tops[index]
        const railY = top + ROW_LABEL_H + RAIL_H / 2

        return (
          <g key={row.taskId}>
            <text x={PLOT_L} y={top + 12} fontSize="13" fill="var(--color-text-primary)">
              {row.title}
            </text>
            <text x={PLOT_R} y={top + 12} textAnchor="end" fontSize="13" fill="var(--color-text-muted)">
              {formatHour(row.window.median)}
            </text>

            <line
              x1={x(HOUR_FROM)}
              y1={railY}
              x2={x(HOUR_TO)}
              y2={railY}
              stroke="var(--color-surface-track)"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {row.point && (
              <rect
                x={x(row.point.hour)}
                y={railY - BAND_H / 2}
                width={Math.max(0, x(HOUR_TO) - x(row.point.hour))}
                height={BAND_H}
                rx={BAND_H / 2}
                fill="url(#rail-dead)"
                opacity="0.5"
              />
            )}

            {/* A window tighter than the dot has no room for a dot inside it. Then the band *is*
                the answer, and it takes the bright mark colour: at that size it is a mark, not an
                area, and a muted pill would read as no data at all. */}
            <rect
              x={x(row.window.low)}
              y={railY - BAND_H / 2}
              width={Math.max(BAND_H, x(row.window.high) - x(row.window.low))}
              height={BAND_H}
              rx={BAND_H / 2}
              fill={isTight(row) ? 'var(--teal-500)' : 'var(--teal-700)'}
            />

            {row.wasMedian !== null && (
              <>
                <line
                  x1={x(row.wasMedian)}
                  y1={railY}
                  x2={x(row.window.median)}
                  y2={railY}
                  stroke="var(--ink-400)"
                  strokeWidth="1.5"
                />
                {/* Where it used to sit. Hollow, so the filled dot stays the present. */}
                <circle
                  cx={x(row.wasMedian)}
                  cy={railY}
                  r={DOT_R - 0.75}
                  fill="none"
                  stroke="var(--ink-400)"
                  strokeWidth="1.5"
                />
              </>
            )}

            {/* A 2px surface ring keeps the dot readable wherever it lands on the band. */}
            {!isTight(row) && (
              <circle
                cx={x(row.window.median)}
                cy={railY}
                r={DOT_R}
                fill="var(--teal-500)"
                stroke="var(--color-surface)"
                strokeWidth="2"
              />
            )}

            {row.point && (
              <line
                x1={x(row.point.hour)}
                y1={railY - 9}
                x2={x(row.point.hour)}
                y2={railY + 9}
                stroke="var(--ink-100)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}

            {row.point && (
              // Anchored away from the edge it is near, so the caption never runs off the chart:
              // Cyrillic is wide, and a fixed clamp guesses its width wrong.
              <text
                x={x(row.point.hour)}
                y={top + ROW_LABEL_H + RAIL_H + 9}
                textAnchor={x(row.point.hour) > VIEW_W / 2 ? 'end' : 'start'}
                fontSize="10"
                fill="var(--color-text-muted)"
              >
                {`после ${formatHour(row.point.hour)} почти не бывает`}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
