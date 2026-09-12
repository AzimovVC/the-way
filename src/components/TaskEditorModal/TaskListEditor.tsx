import { useState } from 'react'
import TaskEditorModal, { DIFFICULTY_LABEL, type TaskEditorValue } from './TaskEditorModal'

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
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-text-primary">{title}</p>

      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="flex-1 text-text-primary">{task.title}</span>
          <span className="text-xs">{DIFFICULTY_LABEL[task.difficulty]}</span>
          <span className="text-xs">{task.targetDays} дн.</span>
          <button type="button" onClick={() => setEditing(task.id)} className="text-xs text-text-secondary underline">
            Изм.
          </button>
          <button type="button" onClick={() => onRemove(task.id)} className="text-xs text-red-400">
            Удалить
          </button>
        </div>
      ))}

      {canAddMore && (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary"
        >
          + Добавить задачу
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
