import { useState } from 'react'
import TaskEditorModal, { type TaskEditorValue } from './TaskEditorModal'
import { DIFFICULTY_LABEL } from './difficulty'

export interface DraftTask extends TaskEditorValue {
  id: string
}

export interface TaskListEditorProps {
  title: string
  tasks: DraftTask[]
  maxTasks: number
  onAdd: (task: TaskEditorValue) => void
  onEdit: (taskId: string, task: TaskEditorValue) => void
  onRemove: (taskId: string) => void
}

/** Shared list-of-tasks block backed by TaskEditorModal, reused by onboarding, the profile screen and the milestone screen. */
export default function TaskListEditor({ title, tasks, maxTasks, onAdd, onEdit, onRemove }: TaskListEditorProps) {
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const canAddMore = tasks.length < maxTasks
  const editingTask = editing && editing !== 'new' ? tasks.find((t) => t.id === editing) : undefined

  return (
    <div className="sk-card-nested flex flex-col gap-2.5">
      <p className="sk-eyebrow">{title}</p>

      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2 text-[15px]">
          <span className="min-w-0 flex-1 truncate text-text-primary">{task.title}</span>
          <span className="sk-num shrink-0 text-[12px] text-text-muted">
            {DIFFICULTY_LABEL[task.difficulty]} · {task.targetDays} дн.
          </span>
          <button
            type="button"
            onClick={() => setEditing(task.id)}
            className="sk-press sk-focus shrink-0 rounded-[8px] px-1.5 py-1 text-[13px] font-bold text-text-secondary"
          >
            Изм.
          </button>
          <button
            type="button"
            onClick={() => onRemove(task.id)}
            className="sk-press sk-focus shrink-0 rounded-[8px] px-1.5 py-1 text-[13px] font-bold"
            style={{ color: 'var(--coral-500)' }}
          >
            Удалить
          </button>
        </div>
      ))}

      {canAddMore && (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
        >
          Добавить привычку
        </button>
      )}

      {editing === 'new' && (
        <TaskEditorModal onSave={(value) => { onAdd(value); setEditing(null) }} onCancel={() => setEditing(null)} />
      )}
      {editingTask && (
        <TaskEditorModal
          initial={editingTask}
          onSave={(value) => { onEdit(editingTask.id, value); setEditing(null) }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
