export interface CompareRow {
  caption: string
  rate: number
}

/**
 * Two readings of one measure under two conditions. One hue for both bars — they are the same
 * series, and colouring them differently would claim an identity they do not have; the captions
 * carry which is which.
 */
export default function CompareBars({ rows, footnote }: { rows: CompareRow[]; footnote: string }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.caption} className="flex items-center gap-3">
          <span className="w-[86px] shrink-0 text-[13px] text-text-secondary">{row.caption}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--color-surface-track)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, row.rate * 100)}%`, backgroundColor: 'var(--teal-700)' }}
            />
          </div>
          <span className="sk-num w-[38px] shrink-0 text-right text-[13px] text-text-primary">
            {Math.round(row.rate * 100)}%
          </span>
        </div>
      ))}
      <p className="text-[12px] text-text-muted">{footnote}</p>
    </div>
  )
}
