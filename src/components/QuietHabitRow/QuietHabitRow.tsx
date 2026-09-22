import Switch from '../Switch'

export interface QuietHabitRowProps {
  value: boolean
  onChange: (next: boolean) => void
  /**
   * У привычки уже есть пара. Тогда переключатель не работает, и это не придирка: партнёр видит
   * её галочки прямо сейчас, и «только для меня» над живым кружком было бы обещанием, которого
   * приложение не держит.
   */
  shared?: boolean
}

/**
 * «Только для меня» — привычка, о которой наружу не уезжает ничего.
 *
 * Стоит одной строкой, а не за «ещё настройками», потому что решение принимают в ту же секунду,
 * когда пишут название: «Таблетки» и «Не пить» — это ровно те слова, из-за которых человек иначе
 * выключил бы социальную половину приложения целиком.
 *
 * Оговорка под ней снимает то, что переключатель обещает лишнего. Он **про чужие глаза, и только**:
 * день спрашивает тихую привычку как любую другую, считает её так же, и уровень она берёт такой же.
 */
export default function QuietHabitRow({ value, onChange, shared = false }: QuietHabitRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-medium text-text-primary">Только для меня</span>
          <span className="text-[12px] text-text-muted">
            {shared
              ? 'Это общая привычка — её галочки видит партнёр.'
              : 'Ни в ленте, ни на полке у друзей её не будет.'}
          </span>
        </span>
        <span className="ml-auto shrink-0">
          <Switch
            checked={value && !shared}
            onChange={onChange}
            disabled={shared}
            label="Только для меня"
          />
        </span>
      </div>
      {value && !shared && (
        <p className="text-[12px] text-text-muted">
          На день и на уровень это не влияет — считается она как все.
        </p>
      )}
    </div>
  )
}
