import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import SettingsRow from '../components/SettingsRow'
import SettingsSection from '../components/SettingsSection'
import SignInForm from '../components/SignInForm'
import { formatHandle } from '../domain/handle'
import { useAuth } from '../supabase/authState'

/**
 * Аккаунт: почта, код из письма и выход.
 *
 * Вход **ничего не открывает и ничего не закрывает** — дорога живёт на телефоне и работает без
 * сети, потому что приложение PWA и день, отмеченный в метро, не имеет права потеряться. Аккаунт
 * нужен для другого: чтобы у тебя был ник, по которому тебя найдут, и чтобы история переживала
 * потерянный телефон. Поэтому это строка в настройках, а не ворота перед первым экраном.
 *
 * Сама форма живёт отдельно (`SignInForm`): второе её место — онбординг, где вернувшийся забирает
 * свою историю из аккаунта прежде, чем заведёт первую привычку.
 */
export default function AccountScreen() {
  const { configured, status, email, profile, error, signOut } = useAuth()

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <Link
            to="/profile/settings"
            aria-label="Назад в настройки"
            className="sk-press sk-focus -ml-2 rounded-[16px] p-2"
          >
            <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
          </Link>
          <h1 className="sk-heading text-[32px] text-text-primary">Аккаунт</h1>
        </div>

        {!configured ? (
          <p className="text-[13px] text-text-muted">
            Сервер ещё не подключён. Всё остальное работает как раньше: дорога лежит на этом
            телефоне.
          </p>
        ) : status === 'loading' ? (
          <p className="text-[13px] text-text-muted">Загружаю…</p>
        ) : status === 'signed-in' ? (
          <>
            <SettingsSection title="Ты вошёл">
              <SettingsRow
                label="Почта"
                right={<span className="text-[15px] text-text-muted">{email}</span>}
              />
              <SettingsRow
                label="Ник"
                hint={profile === null ? 'Ещё не занят — выбери его в настройках' : 'По нему тебя найдут друзья'}
                right={
                  <span className="text-[15px] font-medium text-text-primary">
                    {profile === null ? '—' : formatHandle(profile.handle)}
                  </span>
                }
              />
            </SettingsSection>

            {/* Сказано до кнопки, а не после нажатия: «Выйти» в приложении, где вся история лежит
                на телефоне, читается как «стереть всё», и человек, который так и прочитал, просто
                не нажмёт её никогда. */}
            <p className="text-[12px] text-text-muted">
              Выход уносит только аккаунт и друзей. Дорога остаётся здесь — она и так живёт на этом
              телефоне.
            </p>
            <button type="button" onClick={() => void signOut()} className="sk-btn sk-btn-outline sk-press sk-btn-block">
              Выйти
            </button>

            {error && (
              <p className="text-[13px]" style={{ color: 'var(--color-day-red)' }}>
                {error}
              </p>
            )}
          </>
        ) : (
          <SignInForm
            intro={
              <p className="text-[13px] text-text-secondary">
                Аккаунт нужен, чтобы тебя нашли по нику и чтобы история пережила потерянный телефон.
                Дорога остаётся на телефоне и работает без сети.
              </p>
            }
          />
        )}
      </div>
    </AppShell>
  )
}
