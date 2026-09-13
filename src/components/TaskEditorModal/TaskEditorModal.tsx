import { useState } from 'react'
import { TASK_DIFFICULTY_TARGET_DAYS, type TaskDifficulty } from '../../domain/config'

export const DIFFICULTY_LABEL: Record<TaskDifficulty, string> = {
  simple: 'Простая',
  medium: 'Средняя',
  hard: 'Сложная',
}

export interface TaskEditorValue {
  title: string
  difficulty: TaskDifficulty
  targetDays: number
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

  function changeDifficulty(next: TaskDifficulty) {
    setDifficulty(next)
    setTargetDays(TASK_DIFFICULTY_TARGET_DAYS[next])
  }

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ title: trimmed, difficulty, targetDays })
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 px-4 pb-6 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-xs flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-text-primary">{initial ? 'Редактировать задачу' : 'Новая задача'}</h3>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название задачи"
          autoFocus
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
        />

        <div className="flex gap-2">
          {(Object.keys(DIFFICULTY_LABEL) as TaskDifficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => changeDifficulty(d)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${
                difficulty === d ? 'border-brand bg-brand/20 text-text-primary' : 'border-border text-text-secondary'
              }`}
            >
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Цель, дней:
          <input
            type="number"
            min={1}
            value={targetDays}
            onChange={(e) => setTargetDays(Number(e.target.value) || 1)}
            className="w-20 rounded border border-border bg-bg px-2 py-1 text-xs text-text-primary"
          />
        </label>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text-primary">
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-bg disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
