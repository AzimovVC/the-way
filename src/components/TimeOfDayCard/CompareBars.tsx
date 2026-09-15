import { daysWord } from '../../domain/analytics'

export interface CompareRow {
  caption: string
  rate: number
  /** Days this reading averages, so two conditions of very unequal weight are not read as equal evidence. */
  days?: number
}

/**
 * Two readings of one measure under two conditions. One hue for both bars — they are the same
 * series, and colouring them differently would claim an identity they do not have; the captions
 * carry which is which, and the count beside each says how much day there is behind it.
 *
 * The caption sits above its bar rather than beside it: a task title in a side column wraps to
 * three lines on a phone and drags the bar down to a stub. Full width also makes the difference
 * between the two readings — which is the whole point — the largest thing in the block.
 */
export default function CompareBars({ rows, footnote }: { rows: CompareRow[]; footnote: string }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.caption} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] leading-tight text-text-secondary">
              {row.caption}
              {row.days !== undefined && (
                <span className="text-text-muted">
                  {' · '}
                  {row.days} {daysWord(row.days)}
                </span>
              )}
            </span>
            <span className="sk-num shrink-0 text-[13px] font-semibold text-text-primary">
              {Math.round(row.rate * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--color-surface-track)' }}>
            {/* An exact zero leaves the track empty. The 2px floor is there so a small share stays
                visible, but spent on nothing it draws a nub that reads as «немного», not «нисколько». */}
            {row.rate > 0 && (
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, row.rate * 100)}%`, backgroundColor: 'var(--teal-700)' }}
              />
            )}
          </div>
        </div>
      ))}
      <p className="text-[12px] text-text-muted">{footnote}</p>
    </div>
  )
}
