import { useState } from 'react'
import BackupSection from '../../components/BackupSection'
import Icon from '../../components/Icon'
import { tasksForGoal } from '../../domain/goalShape'
import { EVERY_DAY } from '../../domain/schedule'
import WeekdayPicker from '../../components/WeekdayPicker'
import { buildInitialState } from '../../domain/onboarding'
import {
  TaskListEditor,
  type DraftTask,
  type TaskEditorValue,
} from '../../components/TaskEditorModal'
import { useAppState } from '../../state/appState'

const MAX_GOALS = 3
const MAX_TASKS_PER_GOAL = 5

/**
 * `tasks` empty and `split` false is the ordinary case: the goal is the one thing you do every
 * day, and it needs no second name. See tasksForGoal.
 */
interface DraftGoal {
  id: string
  title: string
  weekdays: number[]
  split: boolean
  tasks: DraftTask[]
}

export default function Onboarding() {
  const { state, setState, askAboutNewHabits } = useAppState()
  const [started, setStarted] = useState(false)
  const [draftGoals, setDraftGoals] = useState<DraftGoal[]>([])
  const [customGoalText, setCustomGoalText] = useState('')

  const canAddMoreGoals = draftGoals.length < MAX_GOALS

  function addGoal() {
    const title = customGoalText.trim()
    if (!title || !canAddMoreGoals) return
    setDraftGoals((prev) => [...prev, { id: crypto.randomUUID(), title, weekdays: EVERY_DAY, split: false, tasks: [] }])
    setCustomGoalText('')
  }

  function removeGoal(goalId: string) {
    setDraftGoals((prev) => prev.filter((g) => g.id !== goalId))
  }

  function addTask(goalId: string, task: TaskEditorValue) {
    setDraftGoals((prev) =>
      prev.map((g) =>
        g.id === goalId && g.tasks.length < MAX_TASKS_PER_GOAL
          ? { ...g, tasks: [...g.tasks, { id: crypto.randomUUID(), ...task }] }
          : g,
      ),
    )
  }

  function editTask(goalId: string, taskId: string, task: TaskEditorValue) {
    setDraftGoals((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, tasks: g.tasks.map((t) => (t.id === taskId ? { ...t, ...task } : t)) } : g,
      ),
    )
  }

  function removeTask(goalId: string, taskId: string) {
    setDraftGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) } : g)),
    )
  }

  function updateGoal(goalId: string, patch: Partial<DraftGoal>) {
    setDraftGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, ...patch } : g)))
  }

  // Every goal yields at least one task now, so the only thing left to require is a goal.
  const canFinish = draftGoals.length > 0

  function finishOnboarding() {
    if (!canFinish) return
    const next = buildInitialState(
      draftGoals.map((g) => ({
        title: g.title,
        tasks: tasksForGoal(g.title, g.split ? g.tasks : [], g.weekdays),
      })),
    )
    setState(next)
    // One screen per habit, in the order they were written down. Three of them in a row is three
    // taps before the road, and that is the minute a person is most willing to answer.
    askAboutNewHabits(state, next)
  }

  return (
    <div className="flex min-h-dvh justify-center bg-surface-sunken">
      <div className="relative flex w-full max-w-[390px] flex-col gap-6 bg-bg px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="sk-heading text-[32px] text-text-primary">The Way</h1>
      </header>

      {!started && (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div
            className="grid size-24 place-items-center rounded-full"
            style={{ backgroundColor: 'var(--color-brand)', boxShadow: '0 6px 0 var(--color-brand-plinth)' }}
          >
            <Icon name="flag" size={44} color="var(--color-text-on-brand)" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="sk-heading text-[26px] text-text-primary">Пока твой путь пуст</h2>
            <p className="text-[15px] text-text-secondary">
              Выбери привычку — и с сегодняшнего дня начнётся твой путь. Он растёт из центра:
              каждый выполненный день ведёт вверх, к цели, каждый пропущенный разворачивает дорогу вниз.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="sk-btn sk-btn-primary sk-btn-lg sk-btn-block sk-plinth sk-focus"
          >
            Начать путь
          </button>

          <BackupSection compact />
        </section>
      )}

      {started && (
        <section className="flex flex-col gap-4">
          <h2 className="sk-heading text-[22px] text-text-primary">Чего ты хочешь?</h2>

          <div className="flex gap-2">
            <input
              value={customGoalText}
              onChange={(e) => setCustomGoalText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGoal()}
              placeholder="Например: больше читать"
              disabled={!canAddMoreGoals}
              className="sk-input flex-1"
            />
            <button
              type="button"
              onClick={addGoal}
              disabled={!canAddMoreGoals || !customGoalText.trim()}
              className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus shrink-0"
            >
              Добавить
            </button>
          </div>

          {/* Each goal arrives with everything it needs already on it — how hard, which days,
              and the way out to several tasks. Splitting that across two screens made the second
              one a form to be filled in about decisions already made on the first. */}
          {draftGoals.map((goal) => (
            <div key={goal.id} className="sk-card-nested flex flex-col gap-2.5">
              <div className="flex items-baseline gap-2">
                <p className="min-w-0 flex-1 truncate text-[15px] text-text-primary">{goal.title}</p>
                <button
                  type="button"
                  onClick={() => removeGoal(goal.id)}
                  className="sk-press sk-focus shrink-0 rounded-[8px] px-1.5 py-1 text-[13px] font-bold"
                  style={{ color: 'var(--coral-500)' }}
                >
                  Убрать
                </button>
              </div>

              {goal.split ? (
                <TaskListEditor
                  title="Привычки"
                  tasks={goal.tasks}
                  maxTasks={MAX_TASKS_PER_GOAL}
                  onAdd={(task) => addTask(goal.id, task)}
                  onEdit={(taskId, task) => editTask(goal.id, taskId, task)}
                  onRemove={(taskId) => removeTask(goal.id, taskId)}
                />
              ) : (
                <>
                  <p className="sk-eyebrow">В какие дни?</p>
                  <WeekdayPicker value={goal.weekdays} onChange={(weekdays) => updateGoal(goal.id, { weekdays })} />

                  <button
                    type="button"
                    onClick={() => updateGoal(goal.id, { split: true })}
                    className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
                  >
                    Разбить на несколько
                  </button>
                </>
              )}
            </div>
          ))}

          <p className="text-[13px] text-text-muted">
            {draftGoals.length === 0
              ? `Напиши, что хочешь делать. До ${MAX_GOALS} привычек — позже можно добавить ещё.`
              : `До ${MAX_GOALS} привычек. Позже можно добавить ещё.`}
          </p>

          <button
            type="button"
            onClick={finishOnboarding}
            disabled={!canFinish}
            className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus mt-auto"
          >
            Начать путь
          </button>

          <BackupSection compact />
        </section>
      )}
      </div>
    </div>
  )
}

