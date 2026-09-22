export interface HabitKindPickerProps {
  /** `true` — привычку бросают, отметка значит «удержался». */
  value: boolean
  onChange: (quit: boolean) => void
}

const CHOICES: { quit: boolean; label: string }[] = [
  { quit: false, label: 'Делаю' },
  { quit: true, label: 'Бросаю' },
]

/**
 * Что это за привычка: та, которую делают, или та, которую бросают.
 *
 * Стоит **под названием**, потому что меняет то, что название значит: «Не курить» в списке дня с
 * галочкой «сделал» читается наоборот. Оба слова названы вслух и оба нажимаемы — «Делаю» это
 * ответ, а не пустое поле, и человек, которому нужен обычный вариант, видит, что он уже выбран.
 *
 * Выбор **не снимается** повторным тапом, в отличие от значка и времени суток: третьего состояния
 * тут нет. Привычка или делается, или бросается, и «неизвестно» не бывает.
 *
 * Пары кнопок, а не переключателя: у переключателя одна подпись, а здесь две противоположности,
 * и та, которую не выбрали, обязана быть видна — иначе «Бросаю» приходится угадывать по тому, что
 * тумблер выключен.
 */
export default function HabitKindPicker({ value, onChange }: HabitKindPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2" role="group" aria-label="Что это за привычка">
        {CHOICES.map((choice) => {
          const on = choice.quit === value
          return (
            <button
              key={choice.label}
              type="button"
              onClick={() => onChange(choice.quit)}
              aria-pressed={on}
              className="sk-focus sk-plinth flex-1 rounded-[14px] py-2 text-[14px] font-bold"
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
              {choice.label}
            </button>
          )
        })}
      </div>
      {value && (
        // Сказано до того, как человек нажмёт «Сохранить», потому что дальше он увидит в дне
        // обычную галочку и должен знать, что она тут значит.
        <p className="text-[12px] text-text-muted">
          Галочка в дне будет значить «сегодня удержался». Спрашивать будет каждый день — сорваться
          можно в любой.
        </p>
      )}
    </div>
  )
}
