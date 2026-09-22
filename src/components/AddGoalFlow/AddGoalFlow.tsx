import { useState } from 'react'
import CirclePicker from '../CirclePicker'
import { TaskListEditor, type DraftTask, type TaskEditorValue } from '../TaskEditorModal'
import { tasksForGoal } from '../../domain/goalShape'
import type { PartOfDay } from '../../domain/partOfDay'
import { EVERY_DAY } from '../../domain/schedule'
import IconPicker from '../IconPicker'
import PartOfDayPicker from '../PartOfDayPicker'
import WeekdayPicker from '../WeekdayPicker'
import { useAppState } from '../../state/appState'
import { newId } from '../../domain/ids'
import { useSocial } from '../../social/socialState'
import type { Person } from '../../social/types'

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
  const { state, dispatch, askAboutNewHabits } = useAppState()
  const { invite } = useSocial()
  const [title, setTitle] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>(EVERY_DAY)
  const [partOfDay, setPartOfDay] = useState<PartOfDay | undefined>(undefined)
  const [icon, setIcon] = useState<string | undefined>(undefined)
  const [split, setSplit] = useState(false)
  const [tasks, setTasks] = useState<DraftTask[]>([])
  // Кого зовут в кружок этой привычкой. Держится здесь, а не внутри строки выбора: приглашение
  // уходит вместе с сохранением, и отправляет его тот, кто сохраняет.
  const [mate, setMate] = useState<Person | null>(null)

  function addTask(task: TaskEditorValue) {
    if (tasks.length >= MAX_TASKS) return
    setTasks((prev) => [...prev, { id: newId(), ...task }])
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
    // Ключ привычки чеканится здесь, до вызова, и по той же причине, по какой он вообще приезжает
    // вместе с действием (`newId` в ids.ts): им же названа привычка в приглашении, и родись он
    // внутри правила, звать было бы нечем.
    const taskId = newId()
    const next = dispatch({
      kind: 'addGoal',
      input: {
        id: newId(),
        title: title.trim(),
        tasks: tasksForGoal(title.trim(), split ? tasks : [], { id: taskId, weekdays, partOfDay, icon }),
      },
    })
    // Зовут **после** того, как привычка заведена: расписание в приглашении то самое, которое
    // человек только что взял на себя, а не обещание, данное за минуту до этого.
    if (mate !== null) {
      void invite({
        id: newId(),
        personId: mate.id,
        taskId,
        title: title.trim(),
        icon,
        weekdays,
        timezone: state.user.timezone,
      })
    }
    askAboutNewHabits(state, next)
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
              <p className="sk-eyebrow">Значок</p>
              <IconPicker value={icon} title={title} onChange={setIcon} />
            </div>

            <div className="flex flex-col gap-2">
              <p className="sk-eyebrow">В какие дни?</p>
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
            </div>

            <div className="flex flex-col gap-2">
              <p className="sk-eyebrow">Когда?</p>
              <PartOfDayPicker value={partOfDay} onChange={setPartOfDay} />
              {/* Оговорка на экране, а не за тапом: тот, кто сейчас выбирает время, через секунду
                  решит, что назначил себе срок, — и это надо опровергнуть, пока он смотрит сюда. */}
              <p className="text-[12px] text-text-muted">
                Это только порядок в списке. Отметить можно в любой час.
              </p>
            </div>

            <CirclePicker value={mate} onChange={setMate} />

            {/* Разбитая цель кружка не держит: кружок — это одна привычка на двоих, а «Отжимания,
                планка, растяжка» не говорит, какая из трёх. Поэтому выбор снимается вместе с
                переходом — оставленный, он звал бы неизвестно чем. */}
            <button
              type="button"
              onClick={() => {
                setMate(null)
                setSplit(true)
              }}
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
