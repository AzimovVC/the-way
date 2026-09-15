import { useState } from 'react'
import { DIFFICULTY_LABEL, TaskListEditor, type DraftTask, type TaskEditorValue } from '../TaskEditorModal'
import type { TaskDifficulty } from '../../domain/config'
import { tasksForGoal } from '../../domain/goalShape'
import { EVERY_DAY } from '../../domain/schedule'
import WeekdayPicker from '../WeekdayPicker'
import { addGoalMidPath } from '../../domain/goalManagement'
import { useAppState } from '../../state/AppStateContext'

const MAX_TASKS = 5

/**
 * Add-a-new-goal-mid-path flow: reachable from the profile screen, the main
 * path screen and (later) the milestone screen. Adds tasks starting today and
 * leaves a permanent marker on the path at this point.
 *
 * One name, not two: the goal is the daily task until the user says otherwise.
 * See tasksForGoal — the split is an extra step for the goals that need it.
 */
export default function AddGoalFlow({ onClose }: { onClose: () => void }) {
  const { state, setState } = useAppState()
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('medium')
  const [weekdays, setWeekdays] = useState<number[]>(EVERY_DAY)
  const [split, setSplit] = useState(false)
  const [tasks, setTasks] = useState<DraftTask[]>([])

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

  const canSave = title.trim().length > 0

  function save() {
    if (!canSave) return
    setState(
      addGoalMidPath(state, {
        title: title.trim(),
        tasks: tasksForGoal(title.trim(), difficulty, split ? tasks : [], weekdays),
      }),
    )
    onClose()
  }

  return (
    <div className="sk-scrim absolute inset-0 z-30 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="sk-dialog hide-scrollbar flex max-h-[85vh] w-full max-w-sm flex-col gap-4 overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="sk-heading text-[22px] text-text-primary">Новая цель</h2>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Что будешь делать каждый день?"
          className="sk-input"
        />

        {!split ? (
          <>
            {/* The difficulty belongs to the task, and while the goal is the task it is asked
                here — a goal without its own screen for it would land on the default forever. */}
            <div className="flex flex-col gap-2">
              <p className="sk-eyebrow">Насколько это сложно?</p>
              <div className="flex gap-2">
                {(Object.keys(DIFFICULTY_LABEL) as TaskDifficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    data-selected={difficulty === d}
                    className="sk-chip sk-plinth sk-focus flex-1 justify-center px-2"
                  >
                    {DIFFICULTY_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="sk-eyebrow">В какие дни?</p>
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
            </div>

            <button
              type="button"
              onClick={() => setSplit(true)}
              className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
            >
              Разбить на задачи
            </button>
          </>
        ) : (
          <>
            <TaskListEditor
              title="Ежедневные задачи"
              tasks={tasks}
              maxTasks={MAX_TASKS}
              onAdd={addTask}
              onEdit={editTask}
              onRemove={removeTask}
            />
            {tasks.length === 0 && (
              <p className="text-[13px] text-text-muted">
                Пока задач нет — цель станет одной задачей с тем же названием.
              </p>
            )}
          </>
        )}

        {!canSave && <p className="text-[13px] text-text-muted">Напиши, что хочешь делать.</p>}

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
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
