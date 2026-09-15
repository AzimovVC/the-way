import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import { updateUserProfile } from '../domain/goalManagement'
import { useAppState } from '../state/appState'

/** The person, not the plan: goals and tasks live on their own tab, one tap away. */
export default function ProfileScreen() {
  const { state, setState } = useAppState()
  const { user } = state

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
      </div>
    </AppShell>
  )
}
