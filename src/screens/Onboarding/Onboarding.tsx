import { useState } from 'react'
import { defaultAntiGoalFor, GOAL_PRESETS } from '../../domain/goalPresets'
import { buildInitialState } from '../../domain/onboarding'
import { TaskListEditor, type DraftTask, type TaskEditorValue } from '../../components/TaskEditorModal'
import { useAppState } from '../../state/AppStateContext'

const MAX_GOALS = 3
const MAX_TASKS_PER_GOAL = 5

interface DraftGoal {
  id: string
  title: string
  antiGoalTitle: string
  tasks: DraftTask[]
}

export default function Onboarding() {
  const { setState } = useAppState()
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [draftGoals, setDraftGoals] = useState<DraftGoal[]>([])
  const [customGoalText, setCustomGoalText] = useState('')

  const canAddMoreGoals = draftGoals.length < MAX_GOALS

  function toggleGoal(title: string) {
    setDraftGoals((prev) => {
      const existing = prev.find((g) => g.title === title)
      if (existing) return prev.filter((g) => g.title !== title)
      if (prev.length >= MAX_GOALS) return prev
      return [...prev, { id: crypto.randomUUID(), title, antiGoalTitle: defaultAntiGoalFor(title), tasks: [] }]
    })
  }

  function addCustomGoal() {
    const title = customGoalText.trim()
    if (!title || !canAddMoreGoals) return
    setDraftGoals((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title, antiGoalTitle: defaultAntiGoalFor(title), tasks: [] },
    ])
    setCustomGoalText('')
  }

  function updateAntiGoal(goalId: string, antiGoalTitle: string) {
    setDraftGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, antiGoalTitle } : g)))
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
        antiGoalTitle: g.antiGoalTitle,
        tasks: g.tasks.map((t) => ({ title: t.title, difficulty: t.difficulty, targetDays: t.targetDays })),
      })),
    )
    setState(state)
  }

  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text-primary">The Way</h1>
        {step > 0 && <p className="text-sm text-text-secondary">Шаг {step} из 3</p>}
      </header>

      {step === 0 && (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="text-6xl">🧭</div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-medium text-text-primary">Пока твой путь пуст</h2>
            <p className="text-sm text-text-secondary">
              Выбери цель, антицель и ежедневные задачи — и с сегодняшнего дня начнётся твой путь. Он растёт из
              центра: каждый выполненный день ведёт к цели, каждый пропущенный — к антицели.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-medium text-text-on-brand"
          >
            Начать путь
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-text-primary">Выбери 1–3 цели</h2>
          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((preset) => {
              const selected = draftGoals.some((g) => g.title === preset.title)
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => toggleGoal(preset.title)}
                  disabled={!selected && !canAddMoreGoals}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selected
                      ? 'border-brand bg-brand/20 text-text-primary'
                      : 'border-border text-text-secondary disabled:opacity-40'
                  }`}
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
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary disabled:opacity-40"
            />
            <button
              type="button"
              onClick={addCustomGoal}
              disabled={!canAddMoreGoals || !customGoalText.trim()}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary disabled:opacity-40"
            >
              Добавить
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={draftGoals.length === 0}
            className="mt-auto rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-40"
          >
            Далее
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-text-primary">Определи антицель</h2>
          {draftGoals.map((goal) => (
            <div key={goal.id} className="flex flex-col gap-1">
              <label className="text-sm text-text-secondary">{goal.title}</label>
              <input
                value={goal.antiGoalTitle}
                onChange={(e) => updateAntiGoal(goal.id, e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
              />
            </div>
          ))}

          <div className="mt-auto flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-text-primary"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-text-on-brand"
            >
              Далее
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-6">
          <h2 className="text-lg font-medium text-text-primary">Задачи на каждый день</h2>
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
            <p className="text-sm text-red-400">
              Нужна хотя бы одна задача хотя бы у одной цели, иначе первый день будет пустым.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-text-primary"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={finishOnboarding}
              disabled={!hasAtLeastOneTask}
              className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-40"
            >
              Начать путь
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

