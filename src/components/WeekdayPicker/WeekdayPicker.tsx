import { EVERY_DAY, WEEKDAY_LABELS } from '../../domain/schedule'

export interface WeekdayPickerProps {
  value: number[]
  onChange: (weekdays: number[]) => void
}

/**
 * Seven circles, Monday first. Everything is selected by default: the common case is every day,
 * and a picker that starts empty would make the ordinary answer the one that costs seven taps.
 *
 * The last selected day cannot be turned off. A task with no days is a task that never comes
 * round — deleting it is the honest way to say that, and the road records that as a removal.
 */
export default function WeekdayPicker({ value, onChange }: WeekdayPickerProps) {
  const selected = value.length === 0 ? EVERY_DAY : value

  function toggle(day: number) {
    const next = selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day]
    if (next.length === 0) return
    onChange(next.sort((a, b) => a - b))
  }

  return (
    <div className="flex justify-between gap-1">
      {WEEKDAY_LABELS.map((label, day) => {
        const on = selected.includes(day)
        return (
          <button
            key={label}
            type="button"
            onClick={() => toggle(day)}
            aria-pressed={on}
            aria-label={label}
            className="sk-focus sk-press grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold transition-colors"
            style={
              on
                ? {
                    backgroundColor: 'var(--color-brand)',
                    color: 'var(--color-text-on-brand)',
                    boxShadow: '0 3px 0 var(--color-brand-plinth)',
                  }
                : {
                    color: 'var(--color-text-muted)',
                    boxShadow: 'inset 0 0 0 2px var(--color-border)',
                  }
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
