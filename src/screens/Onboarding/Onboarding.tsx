import { useState } from 'react'
import Icon from '../../components/Icon'
import { GOAL_PRESETS } from '../../domain/goalPresets'
import { buildInitialState } from '../../domain/onboarding'
import { TaskListEditor, type DraftTask, type TaskEditorValue } from '../../components/TaskEditorModal'
import { useAppState } from '../../state/AppStateContext'

const MAX_GOALS = 3
const MAX_TASKS_PER_GOAL = 5

interface DraftGoal {
  id: string
  title: string
  tasks: DraftTask[]
}

export default function Onboarding() {
  const { setState } = useAppState()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [draftGoals, setDraftGoals] = useState<DraftGoal[]>([])
  const [customGoalText, setCustomGoalText] = useState('')

  const canAddMoreGoals = draftGoals.length < MAX_GOALS

  function toggleGoal(title: string) {
    setDraftGoals((prev) => {
      const existing = prev.find((g) => g.title === title)
      if (existing) return prev.filter((g) => g.title !== title)
      if (prev.length >= MAX_GOALS) return prev
      return [...prev, { id: crypto.randomUUID(), title, tasks: [] }]
    })
  }

  function addCustomGoal() {
    const title = customGoalText.trim()
    if (!title || !canAddMoreGoals) return
    setDraftGoals((prev) => [...prev, { id: crypto.randomUUID(), title, tasks: [] }])
    setCustomGoalText('')
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

  const hasAtLeastOneTask = draftGoals.some((g) => g.tasks.length > 0)

  function finishOnboarding() {
    if (!hasAtLeastOneTask) return
    const state = buildInitialState(
      draftGoals.map((g) => ({
        title: g.title,
        tasks: g.tasks.map((t) => ({ title: t.title, difficulty: t.difficulty, targetDays: t.targetDays })),
      })),
    )
    setState(state)
  }

  return (
    <div className="flex min-h-dvh justify-center bg-surface-sunken">
      <div className="relative flex w-full max-w-[390px] flex-col gap-6 bg-bg px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="sk-heading text-[32px] text-text-primary">The Way</h1>
        {step > 0 && <p className="sk-eyebrow">Шаг {step} из 2</p>}
      </header>

      {step === 0 && (
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
              Выбери цель и ежедневные задачи — и с сегодняшнего дня начнётся твой путь. Он растёт из центра:
              каждый выполненный день ведёт вверх, к цели, каждый пропущенный разворачивает дорогу вниз.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="sk-btn sk-btn-primary sk-btn-lg sk-btn-block sk-plinth sk-focus"
          >
            Начать путь
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h2 className="sk-heading text-[22px] text-text-primary">Выбери 1–3 цели</h2>
          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((preset) => {
              const selected = draftGoals.some((g) => g.title === preset.title)
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => toggleGoal(preset.title)}
                  disabled={!selected && !canAddMoreGoals}
                  data-selected={selected}
                  className="sk-chip sk-plinth sk-focus"
                >
                  {preset.title}
                </button>
              )
            })}
          </div>

          <div className="flex gap-2">
            <input
              value={customGoalText}
              onChange={(e) => setCustomGoalText(e.target.value)}
              placeholder="Своя цель"
              disabled={!canAddMoreGoals}
              className="sk-input flex-1"
            />
            <button
              type="button"
              onClick={addCustomGoal}
              disabled={!canAddMoreGoals || !customGoalText.trim()}
              className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus shrink-0"
            >
              Добавить
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={draftGoals.length === 0}
            className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus mt-auto"
          >
            Далее
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-6">
          <h2 className="sk-heading text-[22px] text-text-primary">Задачи на каждый день</h2>
          {draftGoals.map((goal) => (
            <TaskListEditor
              key={goal.id}
              title={goal.title}
              tasks={goal.tasks}
              maxTasks={MAX_TASKS_PER_GOAL}
              onAdd={(task) => addTask(goal.id, task)}
              onEdit={(taskId, task) => editTask(goal.id, taskId, task)}
              onRemove={(taskId) => removeTask(goal.id, taskId)}
            />
          ))}

          {!hasAtLeastOneTask && (
            <p className="text-[15px]" style={{ color: 'var(--coral-500)' }}>
              Нужна хотя бы одна задача хотя бы у одной цели, иначе первый день будет пустым.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="sk-btn sk-btn-outline sk-press sk-focus flex-1"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={finishOnboarding}
              disabled={!hasAtLeastOneTask}
              className="sk-btn sk-btn-primary sk-plinth sk-focus flex-1"
            >
              Начать путь
            </button>
          </div>
        </section>
      )}
      </div>
    </div>
  )
}

