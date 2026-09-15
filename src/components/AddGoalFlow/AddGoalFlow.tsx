import { useState } from 'react'
import { TaskListEditor, type DraftTask, type TaskEditorValue } from '../TaskEditorModal'
import { GOAL_PRESETS } from '../../domain/goalPresets'
import { addGoalMidPath } from '../../domain/goalManagement'
import { useAppState } from '../../state/AppStateContext'

const MAX_TASKS = 5

/**
 * Add-a-new-goal-mid-path flow: reachable from the profile screen, the main
 * path screen and (later) the milestone screen. Adds tasks starting today and
 * leaves a permanent marker on the path at this point.
 */
export default function AddGoalFlow({ onClose }: { onClose: () => void }) {
  const { state, setState } = useAppState()
  const [title, setTitle] = useState('')
  const [tasks, setTasks] = useState<DraftTask[]>([])

  const existingTitles = new Set(state.user.goals.filter((g) => !g.archived).map((g) => g.title))

  function addTask(task: TaskEditorValue) {
    if (tasks.length >= MAX_TASKS) return
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), ...task }])
  }

  function editTask(taskId: string, task: TaskEditorValue) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...task } : t)))
  }

  function removeTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  const canSave = title.trim().length > 0 && tasks.length > 0

  function save() {
    if (!canSave) return
    const next = addGoalMidPath(state, {
      title: title.trim(),
      tasks: tasks.map((t) => ({ title: t.title, difficulty: t.difficulty, targetDays: t.targetDays })),
    })
    setState(next)
    onClose()
  }

  return (
    <div className="sk-scrim absolute inset-0 z-30 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="sk-dialog hide-scrollbar flex max-h-[85vh] w-full max-w-sm flex-col gap-4 overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="sk-heading text-[22px] text-text-primary">Новая цель</h2>

        <div className="flex flex-wrap gap-2">
          {GOAL_PRESETS.filter((p) => !existingTitles.has(p.title)).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setTitle(preset.title)}
              data-selected={title === preset.title}
              className="sk-chip sk-plinth sk-focus"
            >
              {preset.title}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название цели"
          className="sk-input"
        />

        <TaskListEditor
          title="Ежедневные задачи"
          tasks={tasks}
          maxTasks={MAX_TASKS}
          onAdd={addTask}
          onEdit={editTask}
          onRemove={removeTask}
        />

        {!canSave && (
          <p className="text-[13px] text-text-muted">Укажи название цели и добавь хотя бы одну задачу.</p>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="sk-btn sk-btn-outline sk-press sk-focus flex-1">
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="sk-btn sk-btn-primary sk-plinth sk-focus flex-1"
          >
            Добавить цель
          </button>
        </div>
      </div>
    </div>
  )
}
