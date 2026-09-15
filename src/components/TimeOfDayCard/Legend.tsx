export interface LegendProps {
  /** Only marks actually drawn are named — a legend for an absent mark sends the eye hunting. */
  hasPoint: boolean
  hasGhost: boolean
}

/** Identity is never colour alone: every mark on the rail is named here. */
export default function Legend({ hasPoint, hasGhost }: LegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: 'var(--teal-700)' }} />
        обычное время
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: 'var(--teal-500)' }} />
        чаще всего
      </span>
      {hasGhost && (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full border-[1.5px]"
            style={{ borderColor: 'var(--ink-400)' }}
          />
          было раньше
        </span>
      )}
      {hasPoint && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 rounded-full" style={{ backgroundColor: 'var(--ink-100)' }} />
          дальше почти не бывает
        </span>
      )}
    </div>
  )
}
