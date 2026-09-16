import { useState } from 'react'
import { TASK_DIFFICULTY_TARGET_DAYS, type TaskDifficulty } from '../../domain/config'
import { DIFFICULTY_LABEL } from './difficulty'
import { EVERY_DAY } from '../../domain/schedule'
import WeekdayPicker from '../WeekdayPicker'

export interface TaskEditorValue {
  title: string
  difficulty: TaskDifficulty
  targetDays: number
  /** Monday-first weekday indices; every day when the user never narrows it. */
  weekdays: number[]
}

export interface TaskEditorModalProps {
  initial?: TaskEditorValue
  /**
   * Days already walked, when editing a running task. A finish at or below them would raise
   * «Цель пройдена» the same second for a path nobody walked, so those choices are closed.
   */
  walkedDays?: number
  /** True once the target was reached: the question «дальше или хватит» has been asked and answered. */
  targetLocked?: boolean
  onSave: (value: TaskEditorValue) => void
  onCancel: () => void
}

/** Shared add/edit-task flow, reused by onboarding, the task list, and the milestone screen. */
export default function TaskEditorModal({
  initial,
  walkedDays = 0,
  targetLocked = false,
  onSave,
  onCancel,
}: TaskEditorModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [difficulty, setDifficulty] = useState<TaskDifficulty>(initial?.difficulty ?? 'medium')
  const [targetDays, setTargetDays] = useState(initial?.targetDays ?? TASK_DIFFICULTY_TARGET_DAYS.medium)
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? EVERY_DAY)

  function changeDifficulty(next: TaskDifficulty) {
    setDifficulty(next)
    setTargetDays(TASK_DIFFICULTY_TARGET_DAYS[next])
  }

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ title: trimmed, difficulty, targetDays, weekdays })
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

        {/* The finish only ever moves forward. A habit that has already passed its own finish is
            not asked again here at all — that question belongs to the screen where it was asked. */}
        {targetLocked ? (
          <p className="text-[12px] text-text-muted">
            Цель уже пройдена — дальше идут уровни, и менять финиш больше не нужно.
          </p>
        ) : (
        <div className="flex gap-2">
          {(Object.keys(DIFFICULTY_LABEL) as TaskDifficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              disabled={TASK_DIFFICULTY_TARGET_DAYS[d] <= walkedDays}
              onClick={() => changeDifficulty(d)}
              data-selected={difficulty === d}
              className="sk-chip sk-plinth sk-focus flex-1 justify-center px-2 disabled:opacity-40"
            >
              <span className="flex flex-col items-center leading-tight">
                <span>{DIFFICULTY_LABEL[d]}</span>
                <span className="sk-num text-[11px] opacity-70">{TASK_DIFFICULTY_TARGET_DAYS[d]} дн.</span>
              </span>
            </button>
          ))}
        </div>
        )}

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
