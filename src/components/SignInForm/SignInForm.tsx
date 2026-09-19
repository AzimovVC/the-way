import { useState, type ReactNode } from 'react'
import { useAuth } from '../../supabase/authState'

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

export interface SignInFormProps {
  /**
   * Зачем входить — словами того экрана, на котором форма стоит: в настройках это про ник и
   * потерянный телефон, на онбординге — про путь, который надо забрать. Показывается только на
   * шаге адреса: на шаге кода человек уже решился, и абзац «зачем» спорил бы с «код ушёл на …».
   */
  intro?: ReactNode
  /** Что сделать, когда код подошёл. Экрану аккаунта нечего делать, онбордингу — есть. */
  onSignedIn?: () => void
}

/**
 * Почта и код из письма — две трети экрана входа, которые нужны в двух местах: в настройках и на
 * онбординге, у вернувшегося за своим путём.
 *
 * Код, а не ссылка из письма. Ссылка уводит в браузер и возвращает человека уже не в приложение,
 * установленное на домашний экран, а во вторую его копию — с той же дорогой, но с другим окном.
 * Шесть цифр набираются там, где человек стоит.
 */
export default function SignInForm({ intro, onSignedIn }: SignInFormProps) {
  const { error, requestCode, verifyCode } = useAuth()

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
    if (!ok) return
    setSentTo(null)
    setCode('')
    setAddress('')
    onSignedIn?.()
  }

  return (
    <div className="flex flex-col gap-4">
      {sentTo === null ? (
        <>
          {intro}
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
            Код ушёл на <span className="text-text-primary">{sentTo}</span>. Живёт несколько минут.
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
  )
}
