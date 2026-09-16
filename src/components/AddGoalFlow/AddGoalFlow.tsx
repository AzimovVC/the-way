import { useState } from 'react'
import { TaskListEditor, type DraftTask, type TaskEditorValue } from '../TaskEditorModal'
import { tasksForGoal } from '../../domain/goalShape'
import { EVERY_DAY } from '../../domain/schedule'
import WeekdayPicker from '../WeekdayPicker'
import { addGoalMidPath } from '../../domain/goalManagement'
import { useAppState } from '../../state/appState'

const MAX_TASKS = 5

/**
 * Add-a-habit-mid-path flow: reachable from the profile screen, the main path screen and (later)
 * the milestone screen. Starts asking from today and leaves a permanent marker on the path here.
 *
 * What a person creates is a habit, singular, with one name. The second level — several habits
 * under one heading — is the extra step behind «Разбить на несколько», and the word «цель» is not
 * spoken until that step is taken. It used to be the other way round: the entry asked for a goal
 * and then quietly turned it into a task with the same name, which made the person name a level
 * they did not have and type filler to get past it.
 *
 * `Goal` stays underneath as the storage shape, because nothing on screen depends on the shape —
 * ranks, the day count and the shelf all belong to the task.
 */
export default function AddGoalFlow({ onClose }: { onClose: () => void }) {
  const { state, setState } = useAppState()
  const [title, setTitle] = useState('')
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
        tasks: tasksForGoal(title.trim(), split ? tasks : [], weekdays),
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
        <h2 className="sk-heading text-[22px] text-text-primary">Новая привычка</h2>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Что будешь делать каждый день?"
          className="sk-input"
        />

        {!split ? (
          <>
            <div className="flex flex-col gap-2">
              <p className="sk-eyebrow">В какие дни?</p>
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
            </div>

            <button
              type="button"
              onClick={() => setSplit(true)}
              className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
            >
              Разбить на несколько
            </button>
          </>
        ) : (
          <>
            <TaskListEditor
              title="Привычки"
              tasks={tasks}
              maxTasks={MAX_TASKS}
              onAdd={addTask}
              onEdit={editTask}
              onRemove={removeTask}
            />
            {tasks.length === 0 && (
              <p className="text-[13px] text-text-muted">
                Пока ничего не добавлено — останется одна привычка с этим названием.
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
