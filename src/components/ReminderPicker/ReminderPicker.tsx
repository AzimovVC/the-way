import type { PartOfDay } from '../../domain/partOfDay'
import { cleanRemindAt, defaultRemindAt } from '../../domain/reminder'
import Switch from '../Switch'

export interface ReminderPickerProps {
  /** `HH:mm` или `undefined` — «не напоминать». */
  value: string | undefined
  onChange: (next: string | undefined) => void
  /** Выбранный отрезок дня: из него берётся час, который предлагают первым. */
  partOfDay?: PartOfDay
  /** Привычку спрашивают не каждый день — тогда и напоминание приходит не каждый день. */
  everyDay: boolean
}

/**
 * «Напомнить» — единственный час в настройках привычки, и стоит он тут потому, что отвечает на
 * другой вопрос, чем время суток: не «когда я это делаю», а «когда мне об этом сказать».
 *
 * Час не предлагают выбрать с нуля: включили — и он уже стоит, взятый из отрезка дня
 * (`defaultRemindAt`). Пустое поле времени здесь было бы не готовым ответом, как пустой ряд
 * значков, а недоделанной настройкой: напоминание без часа — это ничто, включённое вслух.
 *
 * Оговорок под ним две, и обе обязаны стоять на экране, а не за тапом. Первая — что опоздать к
 * напоминанию нельзя: человек, выбирающий час, через секунду прочтёт его как срок. Вторая — что
 * пушей пока нет. Настройка, которая молча ничего не делает, хуже, чем её отсутствие, и это то же
 * правило, по которому в списке настроек стоит слово «скоро».
 */
export default function ReminderPicker({ value, onChange, partOfDay, everyDay }: ReminderPickerProps) {
  const on = value !== undefined

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-medium text-text-primary">Напомнить</span>
          <span className="text-[12px] text-text-muted">
            {everyDay ? 'Каждый день в один час.' : 'Только в те дни, когда привычку спрашивают.'}
          </span>
        </span>
        <span className="ml-auto shrink-0">
          <Switch
            checked={on}
            onChange={(next) => onChange(next ? defaultRemindAt(partOfDay) : undefined)}
            label="Напомнить"
          />
        </span>
      </div>

      {on && (
        <>
          <input
            type="time"
            value={value}
            // Поле времени умеет отдать пустую строку — её нельзя класть в состояние часом.
            onChange={(e) => onChange(cleanRemindAt(e.target.value) ?? value)}
            aria-label="Час напоминания"
            className="sk-input sk-num w-full text-[19px]"
          />
          <p className="text-[12px] text-text-muted">
            Это только час, в который телефон скажет. Отметить можно в любой другой — пропущенное
            напоминание ничего не стоит. Пуши появятся позже: пока это только настройка.
          </p>
        </>
      )}
    </div>
  )
}
