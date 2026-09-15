import { useState } from 'react'
import AddGoalFlow from '../components/AddGoalFlow'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import { archiveGoal, updateAntiGoal, updateUserProfile } from '../domain/goalManagement'
import { useAppState } from '../state/AppStateContext'

export default function ProfileScreen() {
  const { state, setState } = useAppState()
  const { user } = state
  const [addingGoal, setAddingGoal] = useState(false)

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

          {user.goals.map((goal) => (
            <div key={goal.id} className={`sk-card flex flex-col gap-3 ${goal.archived ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="sk-heading text-[19px] text-text-primary">{goal.title}</p>
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

              <label className="flex flex-col gap-1.5">
                <span className="sk-eyebrow">Антицель</span>
                <input
                  value={goal.antiGoalTitle}
                  disabled={goal.archived}
                  onChange={(e) => setState(updateAntiGoal(state, goal.id, e.target.value))}
                  className="sk-input"
                />
              </label>

              <p className="sk-num text-[13px] text-text-muted">{goal.tasks.length} задач(и) в день</p>
            </div>
          ))}
        </section>
      </div>

      {addingGoal && <AddGoalFlow onClose={() => setAddingGoal(false)} />}
    </AppShell>
  )
}
