export interface TogetherModePickerProps {
  /** `true` — строка закрывается только когда отметились оба. */
  value: boolean
  onChange: (together: boolean) => void
  /** Имя того, кого ждут. Ждать можно человека, а не «партнёра», — поэтому оно обязательное. */
  partnerName: string
}

/**
 * Как эта привычка закрывает свой день: каждый сам или только вдвоём.
 *
 * **Выбор, а не переключатель**, и по той же причине, что у «Делаю / Бросаю»: это две разные
 * привычки, а не настройка у одной. Тумблер называет только включённое состояние, и человеку
 * пришлось бы догадываться, чем обернётся выключенный, — а здесь оба ответа стоят рядом и оба
 * нажимаемы. «Каждый сам» — это ответ, а не пустое поле.
 *
 * Спрашивается **в ту же секунду, когда выбирают человека**, и стоит прямо под ним: «вдвоём или
 * каждый сам» приходит в голову ровно тогда, когда решаешь, кого звать. До этого вопроса нет —
 * ждать некого, — поэтому у привычки без пары строки не бывает вовсе.
 *
 * Цена названа вслух и целиком, включая ту её половину, которая случается ночью. Это единственное
 * место в приложении, где чужое молчание стоит тебе дня, и человек либо входит в это с открытыми
 * глазами, либо не входит. Правило «дорога не переписывает прошлое» при этом не двинулось: день
 * закрывается в 3:00 таким, каким закрылся, — ставка сделана на день впереди, а не на прожитый.
 */
export default function TogetherModePicker({ value, onChange, partnerName }: TogetherModePickerProps) {
  const choices: { together: boolean; label: string }[] = [
    { together: false, label: 'Каждый сам' },
    { together: true, label: 'Только вместе' },
  ]

  return (
    <div className="flex flex-col gap-2">
      <p className="sk-eyebrow">Как засчитывать день?</p>
      <div className="flex gap-2" role="group" aria-label="Как засчитывать день">
        {choices.map((choice) => {
          const on = choice.together === value
          return (
            <button
              key={choice.label}
              type="button"
              onClick={() => onChange(choice.together)}
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
      <p className="text-[12px] text-text-muted">
        {value
          ? `Твоя галочка встанет сразу и будет ждать ${partnerName}. Не отметится до конца дня — день закроется без неё. Снять это можно в любой момент.`
          : `Твоя галочка закрывает твой день сама. Отметки ${partnerName} видно рядом, но на твою дорогу они не идут.`}
      </p>
    </div>
  )
}
