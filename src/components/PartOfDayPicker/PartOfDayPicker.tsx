import { PART_OF_DAY, PARTS_OF_DAY, type PartOfDay } from '../../domain/partOfDay'

export interface PartOfDayPickerProps {
  value: PartOfDay | undefined
  onChange: (part: PartOfDay | undefined) => void
}

/**
 * Утро · День · Вечер, и ни одного часа.
 *
 * Выбранное снимается повторным тапом, и это не украшение: «когда угодно» — самый частый честный
 * ответ, и у него нет своей кнопки нарочно. Четвёртая кнопка «неважно» в ряду из трёх выглядит как
 * равноправный выбор и заставляет выбирать там, где выбора нет; пустой ряд говорит то же самое
 * молча.
 */
export default function PartOfDayPicker({ value, onChange }: PartOfDayPickerProps) {
  return (
    <div className="flex gap-2">
      {PARTS_OF_DAY.map((part) => {
        const on = value === part
        const meta = PART_OF_DAY[part]
        return (
          <button
            key={part}
            type="button"
            onClick={() => onChange(on ? undefined : part)}
            aria-pressed={on}
            className="sk-focus sk-plinth flex flex-1 flex-col items-center gap-1 rounded-[16px] px-1 py-2.5"
            style={
              on
                ? {
                    backgroundColor: 'var(--color-brand)',
                    color: 'var(--color-text-on-brand)',
                    ['--plinth-color' as string]: 'var(--color-brand-plinth)',
                    ['--depth-press' as string]: 'var(--depth-press-sm)',
                  }
                : {
                    backgroundColor: 'var(--color-surface-sunken)',
                    color: 'var(--color-text-muted)',
                    boxShadow: 'inset 0 0 0 2px var(--color-border)',
                  }
            }
          >
            <span aria-hidden className="text-[20px] leading-none">
              {meta.emoji}
            </span>
            <span className="text-[13px] font-bold leading-none">{meta.label}</span>
          </button>
        )
      })}
    </div>
  )
}
