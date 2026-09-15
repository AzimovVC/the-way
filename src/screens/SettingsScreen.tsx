import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import BackupSection from '../components/BackupSection'
import Icon from '../components/Icon'
import { updateUserProfile } from '../domain/goalManagement'
import { useAppState } from '../state/appState'

/**
 * Everything the profile used to be: the fields nobody opens twice a year. Pushed off the profile
 * so the витрина is not a form, and reachable by a row at the bottom of it rather than a glyph in
 * the top corner — the corner is the hardest place on a phone to reach with a thumb.
 */
export default function SettingsScreen() {
  const { state, setState } = useAppState()
  const { user } = state

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <Link to="/profile" aria-label="Назад в профиль" className="sk-press sk-focus -ml-2 rounded-[16px] p-2">
            <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
          </Link>
          <h1 className="sk-heading text-[32px] text-text-primary">Настройки</h1>
        </div>

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

        <BackupSection />
      </div>
    </AppShell>
  )
}
