import { useState } from 'react'
import { EVERY_DAY } from '../../domain/schedule'
import WeekdayPicker from '../WeekdayPicker'

export interface TaskEditorValue {
  title: string
  /** Monday-first weekday indices; every day when the user never narrows it. */
  weekdays: number[]
}

export interface TaskEditorModalProps {
  initial?: TaskEditorValue
  onSave: (value: TaskEditorValue) => void
  onCancel: () => void
}

/** Shared add/edit-task flow, reused by onboarding, the task list, and the milestone screen. */
export default function TaskEditorModal({ initial, onSave, onCancel }: TaskEditorModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? EVERY_DAY)

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ title: trimmed, weekdays })
  }

  return (
    <div
      className="sk-scrim absolute inset-0 z-30 flex items-end justify-center px-4 pb-6 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="sk-dialog flex w-full max-w-xs flex-col gap-4 p-5"
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
          <p className="sk-eyebrow">В какие дни?</p>
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          {initial && (
            <p className="text-[12px] text-text-muted">
              Новое расписание считается с сегодня. Прошлые дни остаются с тем, по чему их судили.
            </p>
          )}
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
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
