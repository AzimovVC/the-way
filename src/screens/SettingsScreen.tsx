import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import BackupSection from '../components/BackupSection'
import Icon from '../components/Icon'
import SettingsRow from '../components/SettingsRow'
import SettingsSection from '../components/SettingsSection'
import Switch from '../components/Switch'
import { FREEZE_MONTHLY_ALLOWANCE } from '../domain/config'
import { updateUserProfile } from '../domain/goalManagement'
import { useAppState } from '../state/appState'

/**
 * Everything the profile used to be, grouped the way a phone's own settings are: short titled
 * lists instead of one long form. The grouping is the navigation here — there are no sub-screens
 * yet, and a person looking for «уведомления» finds the word «НАПОМИНАНИЯ» before they find a row.
 *
 * Rows marked `soon` are drawn but not wired. They are in the file on purpose: the shape of the
 * screen is easier to argue about with the future sitting in it, and a dimmed «скоро» never lies
 * about what the app does today.
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

        <SettingsSection title="Ты">
          <SettingsRow
            label="Имя"
            right={
              <input
                value={user.name}
                onChange={(e) => setState(updateUserProfile(state, { name: e.target.value }))}
                placeholder="Как тебя называть?"
                aria-label="Имя"
                className="sk-focus w-[170px] rounded-[8px] bg-transparent px-1 py-0.5 text-right text-[15px] font-medium text-text-primary placeholder:text-text-muted"
              />
            }
          />
          <SettingsRow
            label="Часовой пояс"
            right={
              <input
                value={user.timezone}
                onChange={(e) => setState(updateUserProfile(state, { timezone: e.target.value }))}
                aria-label="Часовой пояс"
                className="sk-focus w-[170px] rounded-[8px] bg-transparent px-1 py-0.5 text-right text-[15px] font-medium text-text-primary"
              />
            }
          />
          <SettingsRow label="Фото профиля" right={<Icon name="chevron-right" size={20} color="var(--color-text-muted)" />} soon />
        </SettingsSection>

        <SettingsSection
          title="Напоминания"
          note={user.notificationsEnabled ? 'Пуши появятся позже — пока это только настройка.' : undefined}
        >
          <SettingsRow
            label="Уведомления"
            right={
              <Switch
                label="Уведомления"
                checked={user.notificationsEnabled}
                onChange={(next) => setState(updateUserProfile(state, { notificationsEnabled: next }))}
              />
            }
          />
          <SettingsRow label="Время напоминания" right={<span className="sk-num text-[15px] text-text-muted">20:00</span>} soon />
          <SettingsRow
            label="Молчать, когда день уже закрыт"
            right={<Switch label="Молчать, когда день уже закрыт" checked={false} onChange={() => {}} disabled />}
            soon
          />
          <SettingsRow label="Тихие часы" right={<span className="sk-num text-[15px] text-text-muted">23:00 — 8:00</span>} soon />
        </SettingsSection>

        <SettingsSection title="Дорога">
          <SettingsRow
            label="Анимации"
            right={<Switch label="Анимации" checked={false} onChange={() => {}} disabled />}
            soon
          />
          <SettingsRow
            label="Вибрация"
            right={<Switch label="Вибрация" checked={false} onChange={() => {}} disabled />}
            soon
          />
          <SettingsRow
            label="Ободряющие фразы"
            right={<Switch label="Ободряющие фразы" checked={false} onChange={() => {}} disabled />}
            soon
          />
          <SettingsRow
            label="Открывать дорогу целиком"
            right={<Switch label="Открывать дорогу целиком" checked={false} onChange={() => {}} disabled />}
            soon
          />
        </SettingsSection>

        <SettingsSection
          title="Заморозки"
          note={`Раз в месяц запас пополняется до ${FREEZE_MONTHLY_ALLOWANCE}.`}
        >
          <SettingsRow
            label="Осталось"
            icon="moon"
            iconColor="var(--color-freeze)"
            right={
              <span className="sk-num text-[19px] font-semibold" style={{ color: 'var(--color-freeze)' }}>
                {user.freezesRemaining}
              </span>
            }
          />
          <SettingsRow
            label="Тратить автоматически"
            right={<Switch label="Тратить автоматически" checked={false} onChange={() => {}} disabled />}
            soon
          />
        </SettingsSection>

        <BackupSection />

        <SettingsSection title="О приложении">
          <SettingsRow label="Что нового" right={<Icon name="chevron-right" size={20} color="var(--color-text-muted)" />} soon />
          <SettingsRow label="Как считаются дни" right={<Icon name="chevron-right" size={20} color="var(--color-text-muted)" />} soon />
        </SettingsSection>
      </div>
    </AppShell>
  )
}
