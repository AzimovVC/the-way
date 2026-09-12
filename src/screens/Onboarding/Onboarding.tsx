import { useState } from 'react'
import type { TaskDifficulty } from '../../domain/config'
import { TASK_DIFFICULTY_TARGET_DAYS } from '../../domain/config'
import { defaultAntiGoalFor, GOAL_PRESETS } from '../../domain/goalPresets'
import { buildInitialState } from '../../domain/onboarding'
import { useAppState } from '../../state/AppStateContext'

const MAX_GOALS = 3
const MAX_TASKS_PER_GOAL = 5

const DIFFICULTY_LABEL: Record<TaskDifficulty, string> = {
  simple: 'Простая',
  medium: 'Средняя',
  hard: 'Сложная',
}

interface DraftTask {
  id: string
  title: string
  difficulty: TaskDifficulty
  targetDays: number
}

interface DraftGoal {
  id: string
  title: string
  antiGoalTitle: string
  tasks: DraftTask[]
}

export default function Onboarding() {
  const { setState } = useAppState()
  const [step, setStep] = useState<1 | 2 | 3>(1)
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

  function addTask(goalId: string, title: string, difficulty: TaskDifficulty) {
    const trimmed = title.trim()
    if (!trimmed) return
    setDraftGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId || g.tasks.length >= MAX_TASKS_PER_GOAL) return g
        return {
          ...g,
          tasks: [
            ...g.tasks,
            {
              id: crypto.randomUUID(),
              title: trimmed,
              difficulty,
              targetDays: TASK_DIFFICULTY_TARGET_DAYS[difficulty],
            },
          ],
        }
      }),
    )
  }

  function removeTask(goalId: string, taskId: string) {
    setDraftGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) } : g)),
    )
  }

  function updateTaskTargetDays(goalId: string, taskId: string, targetDays: number) {
    setDraftGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, tasks: g.tasks.map((t) => (t.id === taskId ? { ...t, targetDays } : t)) }
          : g,
      ),
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text-primary">The Way</h1>
        <p className="text-sm text-text-secondary">Шаг {step} из 3</p>
      </header>

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
                      ? 'border-accent bg-accent/20 text-text-primary'
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
            className="mt-auto rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-40"
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
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg"
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
            <TaskEditor
              key={goal.id}
              goal={goal}
              onAddTask={(title, difficulty) => addTask(goal.id, title, difficulty)}
              onRemoveTask={(taskId) => removeTask(goal.id, taskId)}
              onChangeTargetDays={(taskId, days) => updateTaskTargetDays(goal.id, taskId, days)}
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
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-40"
            >
              Начать путь
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function TaskEditor({
  goal,
  onAddTask,
  onRemoveTask,
  onChangeTargetDays,
}: {
  goal: DraftGoal
  onAddTask: (title: string, difficulty: TaskDifficulty) => void
  onRemoveTask: (taskId: string) => void
  onChangeTargetDays: (taskId: string, days: number) => void
}) {
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('medium')
  const canAddMore = goal.tasks.length < MAX_TASKS_PER_GOAL

  function submit() {
    if (!canAddMore) return
    onAddTask(title, difficulty)
    setTitle('')
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-text-primary">{goal.title}</p>

      {goal.tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="flex-1 text-text-primary">{task.title}</span>
          <span className="text-xs">{DIFFICULTY_LABEL[task.difficulty]}</span>
          <input
            type="number"
            min={1}
            value={task.targetDays}
            onChange={(e) => onChangeTargetDays(task.id, Number(e.target.value) || 1)}
            className="w-16 rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary"
          />
          <button type="button" onClick={() => onRemoveTask(task.id)} className="text-xs text-red-400">
            Удалить
          </button>
        </div>
      ))}

      {canAddMore && (
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Новая задача"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
          />
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as TaskDifficulty)}
            className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-primary"
          >
            <option value="simple">Простая</option>
            <option value="medium">Средняя</option>
            <option value="hard">Сложная</option>
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}
