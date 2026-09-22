import Switch from '../Switch'
import type { TargetValue } from './target'

export interface TargetPickerProps {
  value: TargetValue
  onChange: (next: TargetValue) => void
}

/**
 * Верх счёта. Больше сотни раз за день — это уже не привычка, а замер, и поле, в которое влезает
 * «250», обещает инструмент, которого здесь нет.
 */
const MAX_COUNT = 99
const DEFAULT_COUNT = 3

/** Слова, которые подставляются одним тапом. Свои при этом пишутся руками — список не закрытый. */
const UNITS = ['раз', 'минут', 'стаканов', 'страниц', 'км']

/**
 * «Считать по разам»: цель внутри одного дня и слово, в котором она меряется.
 *
 * Оговорка под ней — не украшение. Счётчик здесь **способ поставить ту же отметку**, а не второе
 * условие: строка закрыта на цели и не закрыта до неё, ровно как непоставленная галочка. Человек,
 * который этого не прочитает, решит, что «5 из 8» даст дню пять восьмых, — и будет искать их в
 * цвете дороги, где их нет.
 */
export default function TargetPicker({ value, onChange }: TargetPickerProps) {
  const on = value !== undefined
  const count = value?.count ?? DEFAULT_COUNT
  const unit = value?.unit ?? ''

  function step(delta: number) {
    if (!value) return
    onChange({ ...value, count: Math.max(1, Math.min(MAX_COUNT, value.count + delta)) })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-medium text-text-primary">Считать по разам</span>
          <span className="text-[12px] text-text-muted">Например, восемь стаканов воды.</span>
        </span>
        <span className="ml-auto shrink-0">
          <Switch
            checked={on}
            onChange={(next) => onChange(next ? { count: DEFAULT_COUNT, unit: '' } : undefined)}
            label="Считать по разам"
          />
        </span>
      </div>

      {on && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={count <= 1}
              aria-label="Меньше"
              className="sk-press sk-focus grid size-10 shrink-0 place-items-center rounded-[12px] bg-surface-sunken text-[20px] font-bold text-text-secondary disabled:opacity-40"
            >
              −
            </button>
            <span className="sk-num w-10 text-center text-[19px] font-bold text-text-primary">{count}</span>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={count >= MAX_COUNT}
              aria-label="Больше"
              className="sk-press sk-focus grid size-10 shrink-0 place-items-center rounded-[12px] bg-surface-sunken text-[20px] font-bold text-text-secondary disabled:opacity-40"
            >
              +
            </button>
            <input
              value={unit}
              onChange={(e) => onChange({ count, unit: e.target.value.slice(0, 12) })}
              placeholder="чего?"
              aria-label="В чём считать"
              className="sk-input min-w-0 flex-1"
            />
          </div>

          {/* Слово можно и не писать: «3 из 8» без существительного — нормальная строка, и пустое
              поле здесь такой же готовый ответ, как пустой ряд значков. */}
          <div className="flex flex-wrap gap-2">
            {UNITS.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => onChange({ count, unit: unit === word ? '' : word })}
                aria-pressed={unit === word}
                className="sk-focus rounded-[12px] px-2.5 py-1 text-[13px] font-bold"
                style={
                  unit === word
                    ? { backgroundColor: 'var(--color-brand)', color: 'var(--color-text-on-brand)' }
                    : {
                        backgroundColor: 'var(--color-surface-sunken)',
                        color: 'var(--color-text-muted)',
                        boxShadow: 'inset 0 0 0 2px var(--color-border)',
                      }
                }
              >
                {word}
              </button>
            ))}
          </div>

          <p className="text-[12px] text-text-muted">
            День считает строку закрытой на {count}-м разе — и не считает ни на каком раньше. Цвет
            дня, серия и уровень от половины не меняются.
          </p>
        </>
      )}
    </div>
  )
}
