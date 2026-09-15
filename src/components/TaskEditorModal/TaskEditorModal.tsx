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
  onSave: (value: TaskEditorValue) => void
  onCancel: () => void
}

/** Shared add/edit-task flow, reused by onboarding, the profile screen and the milestone screen. */
export default function TaskEditorModal({ initial, onSave, onCancel }: TaskEditorModalProps) {
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
        <h3 className="sk-heading text-[19px] text-text-primary">{initial ? 'Редактировать задачу' : 'Новая задача'}</h3>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название задачи"
          autoFocus
          className="sk-input"
        />

        <div className="flex gap-2">
          {(Object.keys(DIFFICULTY_LABEL) as TaskDifficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => changeDifficulty(d)}
              data-selected={difficulty === d}
              className="sk-chip sk-plinth sk-focus flex-1 justify-center px-2"
            >
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <p className="sk-eyebrow">В какие дни?</p>
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
        </div>

        <label className="flex items-center justify-between gap-2 text-[13px] text-text-secondary">
          <span className="whitespace-nowrap">Цель, дней</span>
          <input
            type="number"
            min={1}
            value={targetDays}
            onChange={(e) => setTargetDays(Number(e.target.value) || 1)}
            className="sk-input sk-num w-24 text-right"
          />
        </label>

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
