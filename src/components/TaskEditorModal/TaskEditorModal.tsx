import { useState } from 'react'
import { EVERY_DAY } from '../../domain/schedule'
import PredictionPicker from '../PredictionPicker'
import WeekdayPicker from '../WeekdayPicker'

export interface TaskEditorValue {
  title: string
  /** Monday-first weekday indices; every day when the user never narrows it. */
  weekdays: number[]
  /** The guess, on a habit being created. Never carried by an edit — see below. */
  predictedDays?: number
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
  const [predictedDays, setPredictedDays] = useState<number | undefined>(undefined)

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ title: trimmed, weekdays, predictedDays })
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

        {/* Only while the habit is being made. A guess revised halfway is not a guess, and a
            habit already running has either reached its number or is still walking to it — both
            answers the editor has no business changing. */}
        {!initial && <PredictionPicker value={predictedDays} onChange={setPredictedDays} />}

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
