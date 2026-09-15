import { useState } from 'react'
import AddGoalFlow from '../components/AddGoalFlow'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import TaskEditorModal from '../components/TaskEditorModal'
import { addTaskToGoal, archiveGoal, removeTaskFromGoal, updateUserProfile } from '../domain/goalManagement'
import { isSingleTaskGoal } from '../domain/goalShape'
import { describeSchedule } from '../domain/schedule'
import { useAppState } from '../state/AppStateContext'

const MAX_TASKS_PER_GOAL = 5

export default function ProfileScreen() {
  const { state, setState } = useAppState()
  const { user } = state
  const [addingGoal, setAddingGoal] = useState(false)
  // Which goal's "new task" sheet is open, if any — the goal id doubles as the open flag.
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null)

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <h1 className="sk-heading text-[32px] text-text-primary">Профиль</h1>

        <section className="sk-card flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="sk-eyebrow">Имя</span>
            <input
              value={user.name}
              onChange={(e) => setState(updateUserProfile(state, { name: e.target.value }))}
              placeholder="Как тебя называть?"
              className="sk-input"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="sk-eyebrow">Часовой пояс</span>
            <input
              value={user.timezone}
              onChange={(e) => setState(updateUserProfile(state, { timezone: e.target.value }))}
              className="sk-input"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-[15px] text-text-primary">
            Уведомления
            <input
              type="checkbox"
              checked={user.notificationsEnabled}
              onChange={(e) => setState(updateUserProfile(state, { notificationsEnabled: e.target.checked }))}
              className="size-5 shrink-0"
              style={{ accentColor: 'var(--color-brand)' }}
            />
          </label>
          {user.notificationsEnabled && (
            <p className="text-[13px] text-text-muted">Пуши появятся позже — пока это только настройка.</p>
          )}

          <div className="flex items-center justify-between gap-3 text-[15px] text-text-primary">
            <span className="inline-flex items-center gap-2">
              <Icon name="moon" size={18} color="var(--color-freeze)" />
              Осталось заморозок
            </span>
            <span className="sk-num text-[19px] font-semibold" style={{ color: 'var(--color-freeze)' }}>
              {user.freezesRemaining}
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="sk-eyebrow">Мои цели</h2>
            <button
              type="button"
              onClick={() => setAddingGoal(true)}
              className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
            >
              <Icon name="plus" size={16} />
              Добавить цель
            </button>
          </div>

          {user.goals.map((goal) => {
            // A goal that is still its own single task is shown as one line. Drawing a heading
            // with a list of one identical name under it says the name twice and implies there is
            // a second level here when there is not.
            const single = isSingleTaskGoal(goal)
            return (
            <div key={goal.id} className={`sk-card flex flex-col gap-3 ${goal.archived ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <p className="sk-heading truncate text-[19px] text-text-primary">{goal.title}</p>
                  {single && (
                    <span className="sk-num shrink-0 text-[12px] text-text-muted">{goal.tasks[0].targetDays} дн.</span>
                  )}
                </div>
                {goal.archived ? (
                  <span className="text-[13px] text-text-muted">В архиве</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setState(archiveGoal(state, goal.id))}
                    className="sk-press sk-focus rounded-[8px] px-2 py-1 text-[13px] font-bold"
                    style={{ color: 'var(--coral-500)' }}
                  >
                    Архивировать
                  </button>
                )}
              </div>

              {/* Editing the daily set is the one thing here the road records. Adding or dropping a
                  task changes what every following day is judged against, so it leaves a permanent
                  mark on today's circle — see goalManagement. */}
              <div className="flex flex-col gap-2">
                {single && (
                  <p className="text-[13px] text-text-muted">{describeSchedule(goal.tasks[0].weekdays)}</p>
                )}
                {!single && <p className="sk-eyebrow">Задачи</p>}
                {goal.tasks.length === 0 && (
                  <p className="text-[13px] text-text-muted">Пока ни одной задачи.</p>
                )}
                {!single && goal.tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 text-[15px]">
                    <span className="min-w-0 flex-1 truncate text-text-primary">
                      {task.title}
                      <span className="block text-[12px] text-text-muted">{describeSchedule(task.weekdays)}</span>
                    </span>
                    <span className="sk-num shrink-0 text-[12px] text-text-muted">{task.targetDays} дн.</span>
                    {!goal.archived && (
                      <button
                        type="button"
                        onClick={() => setState(removeTaskFromGoal(state, goal.id, task.id))}
                        className="sk-press sk-focus shrink-0 rounded-[8px] px-1.5 py-1 text-[13px] font-bold"
                        style={{ color: 'var(--coral-500)' }}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                ))}
                {/* Splitting and adding are the same act — a second task is what makes the goal a
                    goal — so it is one button under either label. */}
                {!goal.archived && goal.tasks.length < MAX_TASKS_PER_GOAL && (
                  <button
                    type="button"
                    onClick={() => setAddingTaskTo(goal.id)}
                    className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
                  >
                    {single ? 'Разбить на задачи' : 'Добавить задачу'}
                  </button>
                )}
              </div>
            </div>
            )
          })}
        </section>
      </div>

      {addingGoal && <AddGoalFlow onClose={() => setAddingGoal(false)} />}
      {addingTaskTo && (
        <TaskEditorModal
          onSave={(value) => {
            setState(addTaskToGoal(state, addingTaskTo, value))
            setAddingTaskTo(null)
          }}
          onCancel={() => setAddingTaskTo(null)}
        />
      )}
    </AppShell>
  )
}
