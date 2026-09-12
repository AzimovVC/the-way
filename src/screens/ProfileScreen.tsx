import { useState } from 'react'
import { Link } from 'react-router-dom'
import AddGoalFlow from '../components/AddGoalFlow'
import { archiveGoal, updateAntiGoal, updateUserProfile } from '../domain/goalManagement'
import { useAppState } from '../state/AppStateContext'

export default function ProfileScreen() {
  const { state, setState } = useAppState()
  const { user } = state
  const [addingGoal, setAddingGoal] = useState(false)

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="Назад к пути" className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-text-primary">
          ←
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Профиль</h1>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Имя
          <input
            value={user.name}
            onChange={(e) => setState(updateUserProfile(state, { name: e.target.value }))}
            placeholder="Как тебя называть?"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Часовой пояс
          <input
            value={user.timezone}
            onChange={(e) => setState(updateUserProfile(state, { timezone: e.target.value }))}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary"
          />
        </label>

        <label className="flex items-center justify-between text-sm text-text-primary">
          Уведомления
          <input
            type="checkbox"
            checked={user.notificationsEnabled}
            onChange={(e) => setState(updateUserProfile(state, { notificationsEnabled: e.target.checked }))}
            className="h-5 w-5 accent-accent"
          />
        </label>
        {user.notificationsEnabled && (
          <p className="text-xs text-text-secondary">Пуши появятся позже — пока это только настройка.</p>
        )}

        <div className="flex items-center justify-between text-sm text-text-primary">
          <span>Осталось заморозок</span>
          <span className="font-medium">{user.freezesRemaining}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-secondary">Мои цели</h2>
          <button
            type="button"
            onClick={() => setAddingGoal(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary"
          >
            + Добавить цель
          </button>
        </div>

        {user.goals.map((goal) => (
          <div key={goal.id} className={`flex flex-col gap-2 rounded-xl border border-border p-3 ${goal.archived ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">{goal.title}</p>
              {goal.archived ? (
                <span className="text-xs text-text-secondary">В архиве</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setState(archiveGoal(state, goal.id))}
                  className="text-xs text-red-400"
                >
                  Архивировать
                </button>
              )}
            </div>

            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Антицель
              <input
                value={goal.antiGoalTitle}
                disabled={goal.archived}
                onChange={(e) => setState(updateAntiGoal(state, goal.id, e.target.value))}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
              />
            </label>

            <p className="text-xs text-text-secondary">{goal.tasks.length} задач(и) в день</p>
          </div>
        ))}
      </section>

      {addingGoal && <AddGoalFlow onClose={() => setAddingGoal(false)} />}
    </div>
  )
}
