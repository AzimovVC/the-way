import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import SettingsRow from '../components/SettingsRow'
import SettingsSection from '../components/SettingsSection'
import { formatHandle } from '../domain/handle'
import { useAuth } from '../supabase/authState'

/**
 * Аккаунт: почта и выход.
 *
 * Вход отсюда **ушёл**, и это перемена решения, а не переезд формы. Раньше здесь стояло: «это
 * строка в настройках, а не ворота перед первым экраном» — потому что дорога живёт на телефоне и
 * работает без сети. Первое верно и сейчас, а вывод — нет: приложение стало социальным, и аккаунт
 * в нём не страховка для истории, а то, чем человека зовут. Без него ник выдуман (`handleOf`
 * подбирает его по имени и не занимает ни у кого), ссылка-приглашение зовёт в никуда, а каждый
 * социальный экран пишется с оглядкой на человека, которого здесь нет. Дверь теперь одна и стоит
 * перед приложением — [AuthGate](../components/AuthGate/AuthGate.tsx).
 *
 * Поэтому здесь остался только вошедший: невошедший до этого экрана не доходит. Осталось и главное
 * действие, которое есть только у него, — **выход**.
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
        ) : (
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
              Выход уносит аккаунт и друзей, а дорога остаётся здесь — она и так живёт на этом
              телефоне. Но приложение попросит войти снова: ник и люди без аккаунта не работают.
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
        )}
      </div>
    </AppShell>
  )
}
