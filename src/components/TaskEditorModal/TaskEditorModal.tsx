import { useState } from 'react'
import type { PartOfDay } from '../../domain/partOfDay'
import { EVERY_DAY } from '../../domain/schedule'
import IconPicker from '../IconPicker'
import PartOfDayPicker from '../PartOfDayPicker'
import WeekdayPicker from '../WeekdayPicker'

export interface TaskEditorValue {
  title: string
  /** Monday-first weekday indices; every day when the user never narrows it. */
  weekdays: number[]
  /** Утро, день или вечер. `undefined` — «когда угодно», и это нормальный ответ. */
  partOfDay?: PartOfDay
  /** Эмодзи, выбранная руками. `undefined` — значок подбирается по названию. */
  icon?: string
}

export interface TaskEditorModalProps {
  initial?: TaskEditorValue
  onSave: (value: TaskEditorValue) => void
  onCancel: () => void
  /** Разбить привычку на несколько — только у неразбитой цели. */
  onSplit?: () => void
  /** Завершить привычку намеренно. */
  onFinish?: () => void
  /** Убрать привычку из группы — только когда в группе есть ещё одна. */
  onRemove?: () => void
}

/**
 * Shared add/edit-task flow, reused by onboarding, the task list, and the milestone screen.
 *
 * Порядок полей — это порядок вопросов: что делать, чем это пометить, в какие дни, когда внутри
 * дня. Сверху вниз он идёт от обязательного к необязательному, поэтому человек, которому хватает
 * названия и дней, доходит до кнопки, ни разу не решив ничего лишнего.
 */
export default function TaskEditorModal({
  initial,
  onSave,
  onCancel,
  onSplit,
  onFinish,
  onRemove,
}: TaskEditorModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? EVERY_DAY)
  const [partOfDay, setPartOfDay] = useState<PartOfDay | undefined>(initial?.partOfDay)
  const [icon, setIcon] = useState<string | undefined>(initial?.icon)

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ title: trimmed, weekdays, partOfDay, icon })
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
        <h3 className="sk-heading text-[19px] text-text-primary">{initial ? 'Редактировать привычку' : 'Новая привычка'}</h3>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название привычки"
          autoFocus
          className="sk-input"
        />

        <div className="flex flex-col gap-2">
          <p className="sk-eyebrow">Значок</p>
          <IconPicker value={icon} title={title} onChange={setIcon} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="sk-eyebrow">В какие дни?</p>
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          {initial && (
            <p className="text-[12px] text-text-muted">
              Новое расписание считается с сегодня. Прошлые дни остаются с тем, по чему их судили.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="sk-eyebrow">Когда?</p>
          <PartOfDayPicker value={partOfDay} onChange={setPartOfDay} />
          {/* Оговорка стоит на экране, а не за тапом: человек, который сейчас выбирает время,
              должен прочитать, что опоздать нельзя, ровно в эту секунду — потом он решит, что
              выбрал себе дедлайн, и будет прав по всем привычкам, кроме этой. */}
          <p className="text-[12px] text-text-muted">
            Это только порядок в списке. Отметить можно в любой час — на уровень и на дорогу время
            не влияет.
          </p>
        </div>

        {/* Редкое — внизу и тихо. Раньше эти три стояли рядом с «Изменить» прямо на карточке
            привычки, ряд из одинаковых по весу кнопок, где первая нужна часто, вторая почти
            никогда, а третья раз в жизни: ряд читался как меню. «Завершить» вдобавок обязана
            молчать, пока её не ищут, — решение закончить привычку принимает человек, а не
            приложение. */}
        {(onSplit || onRemove || onFinish) && (
          <div className="flex flex-col items-start gap-1 border-t border-border pt-3">
            {onSplit && (
              <button
                type="button"
                onClick={onSplit}
                className="sk-press sk-focus rounded-[8px] py-1 text-[13px] font-bold text-text-secondary"
              >
                Разбить на несколько
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="sk-press sk-focus rounded-[8px] py-1 text-[13px] font-bold text-text-muted"
              >
                Удалить привычку
              </button>
            )}
            {onFinish && (
              <button
                type="button"
                onClick={onFinish}
                className="sk-press sk-focus rounded-[8px] py-1 text-[13px] font-bold text-text-muted"
              >
                Завершить привычку
              </button>
            )}
          </div>
        )}

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
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
