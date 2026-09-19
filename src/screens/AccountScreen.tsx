import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import SettingsRow from '../components/SettingsRow'
import SettingsSection from '../components/SettingsSection'
import { formatHandle } from '../domain/handle'
import { useAuth } from '../supabase/authState'

/**
 * Длина кода из письма. **Вилка, а не число**: длина OTP — настройка на сервере (6..10), и точное
 * число, вписанное сюда, однажды разойдётся с ней — как разошлось: приложение молча обрезало
 * восьмизначный код до шести цифр и говорило «код не подошёл» про код, который подошёл бы.
 *
 * Нижняя граница нужна только затем, чтобы не отправлять заведомо недобранное; верхняя — чтобы
 * поле не принимало то, чего в письме быть не может.
 */
const CODE_MIN_LENGTH = 6
const CODE_MAX_LENGTH = 10

const FIELD =
  'sk-focus w-full rounded-[12px] border border-border bg-transparent px-3 py-2.5 text-[15px] text-text-primary placeholder:text-text-muted'

/**
 * Аккаунт: почта, код из письма и выход.
 *
 * Вход **ничего не открывает и ничего не закрывает** — дорога живёт на телефоне и работает без
 * сети, потому что приложение PWA и день, отмеченный в метро, не имеет права потеряться. Аккаунт
 * нужен для другого: чтобы у тебя был ник, по которому тебя найдут, и чтобы история переживала
 * потерянный телефон. Поэтому это строка в настройках, а не ворота перед первым экраном.
 *
 * Код, а не ссылка из письма. Ссылка уводит в браузер и возвращает человека уже не в приложение,
 * установленное на домашний экран, а во вторую его копию — с той же дорогой, но с другим окном.
 * Шесть цифр набираются там, где человек стоит.
 */
export default function AccountScreen() {
  const { configured, status, email, profile, error, requestCode, verifyCode, signOut } = useAuth()

  const [address, setAddress] = useState('')
  // Куда письмо ушло. Отдельно от поля ввода: человек правит адрес в поле, а код пришёл на тот,
  // что был отправлен, и проверять его надо против отправленного.
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    const ok = await requestCode(address)
    setBusy(false)
    if (ok) setSentTo(address.trim())
  }

  const verify = async () => {
    if (sentTo === null) return
    setBusy(true)
    const ok = await verifyCode(sentTo, code)
    setBusy(false)
    if (ok) {
      setSentTo(null)
      setCode('')
      setAddress('')
    }
  }

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
          </>
        ) : sentTo === null ? (
          <>
            <p className="text-[13px] text-text-secondary">
              Аккаунт нужен, чтобы тебя нашли по нику и чтобы история пережила потерянный телефон.
              Дорога остаётся на телефоне и работает без сети.
            </p>
            <label className="flex flex-col gap-2">
              <span className="sk-eyebrow">Почта</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ты@почта.рф"
                aria-label="Почта"
                className={FIELD}
              />
            </label>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !address.includes('@')}
              className="sk-btn sk-btn-primary sk-plinth sk-press sk-btn-block"
            >
              {busy ? 'Отправляю…' : 'Прислать код'}
            </button>
          </>
        ) : (
          <>
            <p className="text-[13px] text-text-secondary">
              Код ушёл на <span className="text-text-primary">{sentTo}</span>. Живёт несколько
              минут.
            </p>
            <label className="flex flex-col gap-2">
              <span className="sk-eyebrow">Код из письма</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_MAX_LENGTH))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="Код из письма"
                className={`${FIELD} sk-num tracking-[0.3em]`}
              />
            </label>
            <button
              type="button"
              onClick={() => void verify()}
              disabled={busy || code.length < CODE_MIN_LENGTH}
              className="sk-btn sk-btn-primary sk-plinth sk-press sk-btn-block"
            >
              {busy ? 'Проверяю…' : 'Войти'}
            </button>
            {/* Не «Отправить ещё раз»: вернуться надо в поле адреса, потому что самая частая
                причина ненайденного письма — опечатка в нём, а не пропавшее письмо. */}
            <button
              type="button"
              onClick={() => {
                setSentTo(null)
                setCode('')
              }}
              className="sk-btn sk-btn-ghost sk-press sk-btn-block"
            >
              Другой адрес
            </button>
          </>
        )}

        {error && (
          <p className="text-[13px]" style={{ color: 'var(--color-day-red)' }}>
            {error}
          </p>
        )}
      </div>
    </AppShell>
  )
}
