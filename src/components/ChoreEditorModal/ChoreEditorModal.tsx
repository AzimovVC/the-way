import { useState } from 'react'
import { formatLongDate, nextDay } from '../../domain/calendar'
import IconPicker from '../IconPicker'

export interface ChoreEditorValue {
  title: string
  /** День, на который дело поставлено, YYYY-MM-DD. */
  date: string
  icon?: string
}

export interface ChoreEditorModalProps {
  today: string
  onSave: (value: ChoreEditorValue) => void
  onCancel: () => void
}

/**
 * Новое разовое дело.
 *
 * Здесь у дела **есть календарь**, в отличие от карточки дня, где дат ровно две. Разница не в
 * щедрости, а в том, кто задал вопрос: открывший сегодняшний день спрашивал «что сегодня», и
 * календарь отвечал бы ему не на то. Нажавший «+» спрашивает «что завести», и «только сегодня
 * или завтра» — это отказ отвечать.
 *
 * Раньше сегодняшнего поставить нельзя: дело в прошлом — это не план, а запись о том, чего не
 * было, и приложение такое не пишет.
 */
export default function ChoreEditorModal({ today, onSave, onCancel }: ChoreEditorModalProps) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState<string | undefined>(undefined)
  // Одно значение и три способа его задать — две фишки и календарь. Отдельного «режима даты» нет:
  // выбранный день всегда виден целиком, какой бы кнопкой его ни поставили.
  const [date, setDate] = useState(today)
  const tomorrow = nextDay(today)

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ title: trimmed, date, icon })
  }

  return (
    <div
      className="sk-scrim absolute inset-0 z-30 flex items-end justify-center px-4 pb-6 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="sk-dialog hide-scrollbar flex max-h-[85vh] w-full max-w-xs flex-col gap-4 overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="sk-heading text-[19px] text-text-primary">Новое дело</h3>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Что нужно сделать?"
          autoFocus
          className="sk-input"
        />

        <div className="flex flex-col gap-2">
          <p className="sk-eyebrow">Значок</p>
          <IconPicker value={icon} title={title} onChange={setIcon} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="sk-eyebrow">Когда?</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(today)}
              data-selected={date === today}
              className="sk-chip sk-plinth sk-focus sk-btn-sm"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={() => setDate(tomorrow)}
              data-selected={date === tomorrow}
              className="sk-chip sk-plinth sk-focus sk-btn-sm"
            >
              Завтра
            </button>
          </div>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="День, на который поставить дело"
            className="sk-input"
          />
          {/* День называется словами, а не ключом: `2026-09-19` в поле — это то, что понимает
              браузер, а человек читает «19 сентября». */}
          <p className="text-[12px] text-text-muted">
            {date === today ? 'Сегодня' : date === tomorrow ? 'Завтра' : formatLongDate(date)}. Дело
            не влияет на дорогу — не сделаешь, и ничего не случится.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="sk-btn sk-btn-outline sk-press sk-focus flex-1">
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="sk-btn sk-btn-primary sk-plinth sk-focus flex-1"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
