import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import BackupSection from '../components/BackupSection'
import HandleField from '../components/HandleField'
import Icon from '../components/Icon'
import SettingsRow from '../components/SettingsRow'
import SettingsSection from '../components/SettingsSection'
import Switch from '../components/Switch'
import { FREEZE_MONTHLY_ALLOWANCE } from '../domain/config'
import { handleOf } from '../domain/handle'
import { useSocial } from '../social/socialState'
import { useAuth } from '../supabase/authState'
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
  const { state, dispatch } = useAppState()
  const { view } = useSocial()
  const { configured, status, email, error: authError, checkHandleFree } = useAuth()
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

        {/* Жалоба на ник стоит над списком, а не под полем: она приходит с той стороны через
            секунду после того, как палец ушёл с клавиатуры, и под полем её уже никто не читает. */}
        <SettingsSection title="Ты" note={authError ?? undefined}>
          <SettingsRow
            label="Имя"
            right={
              <input
                value={user.name}
                onChange={(e) => dispatch({ kind: 'updateProfile', patch: { name: e.target.value } })}
                placeholder="Как тебя называть?"
                aria-label="Имя"
                className="sk-focus w-[170px] rounded-[8px] bg-transparent px-1 py-0.5 text-right text-[15px] font-medium text-text-primary placeholder:text-text-muted"
              />
            }
          />
          {/* Ник стоит прямо под именем: это два ответа на один вопрос — как тебя звать, — и
              разница между ними в том, кто спрашивает. Подписи про латиницу нет, её говорит
              само поле, переписывая набранное под пальцем. */}
          <SettingsRow
            label="Ник"
            hint={
              configured && status === 'signed-in'
                ? 'По нему тебя найдут друзья. Занимается сразу'
                : 'По нему тебя найдут друзья'
            }
            right={
              <HandleField
                value={handleOf(user)}
                onChange={(handle) => dispatch({ kind: 'updateProfile', patch: { handle } })}
                // Спрашивать «занят ли» есть у кого только у вошедшего: без сервера ник не у кого
                // занимать, и строка «Этот ник занят» сообщала бы о беде, которой нет.
                checkFree={configured && status === 'signed-in' ? checkHandleFree : undefined}
              />
            }
          />
          <SettingsRow
            label="Часовой пояс"
            right={
              <input
                value={user.timezone}
                onChange={(e) => dispatch({ kind: 'updateProfile', patch: { timezone: e.target.value } })}
                aria-label="Часовой пояс"
                className="sk-focus w-[170px] rounded-[8px] bg-transparent px-1 py-0.5 text-right text-[15px] font-medium text-text-primary"
              />
            }
          />
          <SettingsRow label="Фото профиля" right={<Icon name="chevron-right" size={20} color="var(--color-text-muted)" />} soon />
          {/* Строки нет вовсе, пока нет сервера: «Аккаунт → скоро» в приложении, которое и без
              него работает целиком, обещает то, чего человек не просил. */}
          {configured && (
            <SettingsRow
              label="Аккаунт"
              hint={
                status === 'signed-in'
                  ? (email ?? 'Ты вошёл')
                  : 'Вход по почте. Дорога останется на телефоне'
              }
              to="/profile/settings/account"
            />
          )}
        </SettingsSection>

        {/* Список заблокированных живёт тут, а не среди друзей: там он показывал бы при каждом
            открытии ровно тех, кого человек убрал с глаз. Число стоит справа, чтобы за пустым
            списком не ходили. */}
        <SettingsSection
          title="Люди"
          note="«Привычки видны всем» сохранится сейчас, а заработает вместе с сетью: своего профиля пока никто не запрашивает."
        >
          {/* Умолчание — «только друзьям», и подпись говорит, что видно всегда. Переключатель,
              молчащий о второй половине правила, человек читает как «выключено — значит меня не
              видно вовсе», а имя и ник видны по нику всегда: на то он и ник. */}
          <SettingsRow
            label="Привычки видны всем"
            hint="Иначе — только друзьям. Имя, ник и дни в пути видны по нику всегда."
            right={
              <Switch
                label="Привычки видны всем"
                checked={user.habitsPublic === true}
                onChange={(next) => dispatch({ kind: 'updateProfile', patch: { habitsPublic: next } })}
              />
            }
          />
          <SettingsRow
            label="Заблокированные"
            to="/profile/settings/blocked"
            right={<span className="sk-num text-[15px] text-text-muted">{view.blocked.length}</span>}
          />
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
                onChange={(next) => dispatch({ kind: 'updateProfile', patch: { notificationsEnabled: next } })}
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
