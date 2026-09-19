import { useState } from 'react'
import BackupSection from '../../components/BackupSection'
import Icon from '../../components/Icon'
import SignInForm from '../../components/SignInForm'
import { tasksForGoal } from '../../domain/goalShape'
import type { PartOfDay } from '../../domain/partOfDay'
import { EVERY_DAY } from '../../domain/schedule'
import IconPicker from '../../components/IconPicker'
import PartOfDayPicker from '../../components/PartOfDayPicker'
import WeekdayPicker from '../../components/WeekdayPicker'
import { buildInitialState } from '../../domain/onboarding'
import {
  TaskListEditor,
  type DraftTask,
  type TaskEditorValue,
} from '../../components/TaskEditorModal'
import { useAppState } from '../../state/appState'
import { useRoadSync } from '../../state/roadSyncState'
import { useAuth } from '../../supabase/authState'
import { newId } from '../../domain/ids'

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
  partOfDay?: PartOfDay
  icon?: string
  split: boolean
  tasks: DraftTask[]
}

export default function Onboarding() {
  const { state, setState, askAboutNewHabits } = useAppState()
  const { configured, status } = useAuth()
  const sync = useRoadSync()
  /**
   * Три экрана вместо двух. Вход стоит **до** первой привычки нарочно: заведённая привычка делает
   * устройство непустым, а непустому устройству приложение уже не отдаёт историю молча — оно
   * спрашивает, чью оставить. Вернувшемуся этот вопрос задавать не за что: на его стороне одна
   * строка, написанная минуту назад.
   */
  const [screen, setScreen] = useState<'welcome' | 'signin' | 'goals'>('welcome')
  const [draftGoals, setDraftGoals] = useState<DraftGoal[]>([])
  const [customGoalText, setCustomGoalText] = useState('')

  const canAddMoreGoals = draftGoals.length < MAX_GOALS

  function addGoal() {
    const title = customGoalText.trim()
    if (!title || !canAddMoreGoals) return
    setDraftGoals((prev) => [...prev, { id: newId(), title, weekdays: EVERY_DAY, split: false, tasks: [] }])
    setCustomGoalText('')
  }

  function removeGoal(goalId: string) {
    setDraftGoals((prev) => prev.filter((g) => g.id !== goalId))
  }

  function addTask(goalId: string, task: TaskEditorValue) {
    setDraftGoals((prev) =>
      prev.map((g) =>
        g.id === goalId && g.tasks.length < MAX_TASKS_PER_GOAL
          ? { ...g, tasks: [...g.tasks, { id: newId(), ...task }] }
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
        id: g.id,
        title: g.title,
        tasks: tasksForGoal(g.title, g.split ? g.tasks : [], {
          id: newId(),
          weekdays: g.weekdays,
          partOfDay: g.partOfDay,
          icon: g.icon,
        }),
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

      {screen === 'welcome' && (
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
          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={() => setScreen('goals')}
              className="sk-btn sk-btn-primary sk-btn-lg sk-btn-block sk-plinth sk-focus"
            >
              Начать путь
            </button>

            {/* Второй кнопкой, а не строчкой внизу: тот, кто чистил браузер или взял новый
                телефон, должен найти свою историю **до** того, как заведёт первую привычку.
                Обводкой, а не плинтом — начинающих здесь всё-таки большинство. */}
            {configured && (
              <button
                type="button"
                onClick={() => setScreen('signin')}
                className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus"
              >
                Войти
              </button>
            )}
          </div>

          <BackupSection compact />
        </section>
      )}

      {screen === 'signin' && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScreen('welcome')}
              aria-label="Назад"
              className="sk-press sk-focus -ml-2 rounded-[16px] p-2"
            >
              <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
            </button>
            <h2 className="sk-heading text-[22px] text-text-primary">Вход</h2>
          </div>

          {status === 'loading' ? (
            <p className="text-[13px] text-text-muted">Загружаю…</p>
          ) : status === 'signed-out' ? (
            <SignInForm
              intro={
                <p className="text-[13px] text-text-secondary">
                  Если история уезжала в аккаунт, заберём её сюда. Код придёт на почту.
                </p>
              }
            />
          ) : (
            /* Вошёл. Дальше всё делается само: история из аккаунта приезжает молча, и онбординг
               пропадает вместе с ней — рассказывать тут можно только о том, что происходит. */
            <>
              {sync.phase === 'loading' && (
                <p className="text-[13px] text-text-muted">Смотрю, что лежит в аккаунте…</p>
              )}
              {sync.phase === 'syncing' && (
                <p className="text-[13px] text-text-muted">Забираю историю…</p>
              )}
              {sync.phase === 'idle' && (
                <>
                  <p className="text-[13px] text-text-secondary">
                    В этом аккаунте истории пока нет. Начни — она уедет туда сама.
                  </p>
                  <button
                    type="button"
                    onClick={() => setScreen('goals')}
                    className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus"
                  >
                    Начать путь
                  </button>
                </>
              )}
              {sync.phase === 'blocked' && (
                <p className="text-[13px] text-text-muted">
                  История в аккаунте записана более новой версией приложения ({sync.blockedReason}).
                  Она не трогается: обнови приложение и зайди снова.
                </p>
              )}
              {sync.error && (
                <p className="text-[13px]" style={{ color: 'var(--color-day-red)' }}>
                  {sync.error}
                </p>
              )}
            </>
          )}

          {/* Второй способ вернуться стоит рядом с первым: у кого-то аккаунта не было, а файл
              есть. */}
          <BackupSection compact />
        </section>
      )}

      {screen === 'goals' && (
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

          {/* Each goal arrives with everything it needs already on it — its glyph, which days,
              when in the day, and the way out to several tasks. Splitting that across two screens
              made the second one a form to be filled in about decisions already made on the first.

              Ни значок, ни время дня не обязательны, и ни одно из них не стоит между человеком и
              кнопкой «Начать путь»: пустой ряд значков и пустой ряд времени — это готовый ответ,
              а не незаполненное поле. */}
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
                  <p className="sk-eyebrow">Значок</p>
                  <IconPicker value={goal.icon} title={goal.title} onChange={(icon) => updateGoal(goal.id, { icon })} />

                  <p className="sk-eyebrow">В какие дни?</p>
                  <WeekdayPicker value={goal.weekdays} onChange={(weekdays) => updateGoal(goal.id, { weekdays })} />

                  <p className="sk-eyebrow">Когда?</p>
                  <PartOfDayPicker
                    value={goal.partOfDay}
                    onChange={(partOfDay) => updateGoal(goal.id, { partOfDay })}
                  />
                  {/* Оговорка стоит здесь по той же причине, что и в остальных формах: тот, кто
                      сейчас выбирает время, через секунду решит, что назначил себе срок. */}
                  <p className="text-[12px] text-text-muted">
                    Это только порядок в списке. Отметить можно в любой час.
                  </p>

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

