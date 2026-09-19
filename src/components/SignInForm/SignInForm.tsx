import { useState } from 'react'
import { PASSWORD_MIN_LENGTH, useAuth } from '../../supabase/authState'

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
 * Четыре шага, и первый из них — развилка. Она появилась **вместе с паролем** и не по вкусу:
 * завести аккаунт и войти в него — это два разных вызова к серверу, и одно поле почты их не
 * покрывает. Пока входили кодом, вопрос «ты новый или уже был» не имел смысла — письмо одно и то
 * же, — а теперь имеет, и человеку он всё равно понятнее, чем нам: под двумя кнопками лежат две
 * разные новости, «сейчас заведём» и «сейчас вернём твою дорогу».
 */
type Step = 'choose' | 'new' | 'back' | 'code'

/**
 * Почта и пароль перед дверью приложения.
 *
 * Код из письма никуда не делся и стоит второй дверью: им входит забывший пароль и тот, кто завёл
 * аккаунт до того, как пароли появились. Код, а не ссылка из письма — по той же причине, что и
 * раньше: ссылка уводит в браузер и возвращает человека уже не в приложение с домашнего экрана, а
 * во вторую его копию, с той же дорогой, но в другом окне.
 */
export default function SignInForm() {
  const { error, clearError, signUp, signIn, verifySignUp, requestCode, verifyCode } = useAuth()

  const [step, setStep] = useState<Step>('choose')
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  // Куда письмо ушло. Отдельно от поля ввода: человек правит адрес в поле, а код пришёл на тот,
  // что был отправлен, и проверять его надо против отправленного.
  const [sentTo, setSentTo] = useState<string | null>(null)
  // Каким письмом прислан код. Регистрация подтверждается своим шаблоном и своим типом; тип,
  // перепутанный с письмом, отвечает «код не подошёл» на правильно набранный код.
  const [codeFor, setCodeFor] = useState<'signup' | 'email'>('email')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  // Не беда, а поворот: «такая почта уже есть», «адрес ещё не подтверждён». Отдельно от `error`,
  // потому что красным это читалось бы как отказ, а человека тут просто переставили в другую дверь.
  const [note, setNote] = useState<string | null>(null)

  const addressOk = address.includes('@')
  const passwordOk = password.length >= PASSWORD_MIN_LENGTH

  // Смена шага стирает **обе** строки. Жалоба на пароль, пережившая уход из этой двери, стоит
  // красным над кнопками, к которым она не относится, — и человек читает её как беду с ними.
  const go = (next: Step) => {
    setStep(next)
    setNote(null)
    clearError()
  }

  const register = async () => {
    setBusy(true)
    setNote(null)
    const outcome = await signUp(address, password)
    setBusy(false)
    if (outcome === 'code-sent') {
      setSentTo(address.trim())
      setCodeFor('signup')
      setStep('code')
      return
    }
    if (outcome === 'exists') {
      // Почта остаётся в поле, пароль стирается: он был придуман для нового аккаунта, а нужен от
      // старого. Оставленный, он даёт «пароль не подошёл» на первое же нажатие «Войти».
      setPassword('')
      setNote('Такая почта уже заведена. Войди своим паролем — или возьми код из письма.')
      setStep('back')
    }
  }

  const enter = async () => {
    setBusy(true)
    setNote(null)
    const outcome = await signIn(address, password)
    if (outcome !== 'unconfirmed') {
      setBusy(false)
      return
    }
    // Пароль верный, а адрес так и не подтверждён: человек завёл аккаунт и закрыл письмо. Отказ
    // здесь был бы тупиком — он набирает правильный пароль и слышит, что тот неправильный.
    const sent = await requestCode(address)
    setBusy(false)
    if (!sent) return
    setSentTo(address.trim())
    setCodeFor('email')
    setNote('Адрес ещё не подтверждён. Код ушёл на почту — он его и подтвердит.')
    setStep('code')
  }

  const byCode = async () => {
    setBusy(true)
    setNote(null)
    const sent = await requestCode(address)
    setBusy(false)
    if (!sent) return
    setSentTo(address.trim())
    setCodeFor('email')
    setStep('code')
  }

  const verify = async () => {
    if (sentTo === null) return
    setBusy(true)
    const ok = codeFor === 'signup' ? await verifySignUp(sentTo, code) : await verifyCode(sentTo, code)
    setBusy(false)
    if (!ok) return
    setSentTo(null)
    setCode('')
    setPassword('')
  }

  const addressField = (
    <label className="flex flex-col gap-2">
      <span className="sk-eyebrow">Почта</span>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="you@mail.com"
        aria-label="Почта"
        className={FIELD}
      />
    </label>
  )

  /**
   * «Показать» — не украшение. Пароль набирают на телефонной клавиатуре с автозаменой и точками
   * вместо букв, и единственный способ понять, почему он «не подошёл», — увидеть его.
   */
  const passwordField = (fresh: boolean) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="sk-eyebrow">Пароль</span>
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className="sk-focus rounded-[8px] px-1 text-[12px] text-text-muted"
        >
          {shown ? 'Скрыть' : 'Показать'}
        </button>
      </div>
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type={shown ? 'text' : 'password'}
        autoComplete={fresh ? 'new-password' : 'current-password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={fresh ? `Не короче ${PASSWORD_MIN_LENGTH} знаков` : '••••••••'}
        aria-label="Пароль"
        className={FIELD}
      />
    </div>
  )

  /**
   * Возврат стоит **сверху и один на все шаги**. Внизу, под полями и кнопкой, он уезжал за нижнюю
   * кромку — на открытой клавиатуре его там просто нет, и человек, зашедший не в ту дверь, остаётся
   * в ней запертым. Наверху он виден раньше, чем первое поле, и ни одна из дверей не ловушка.
   *
   * Из шага с кодом он зовётся «Другой адрес» и по той же причине, что и раньше: самая частая
   * причина ненайденного письма — опечатка в адресе, а не пропавшее письмо.
   */
  const leave = () => {
    if (step !== 'code') return go('choose')
    setSentTo(null)
    setCode('')
    go(codeFor === 'signup' ? 'new' : 'back')
  }

  const back = (
    <button
      type="button"
      onClick={leave}
      className="sk-focus -mx-1 self-start rounded-[8px] px-1 py-0.5 text-[13px] text-text-muted"
    >
      ← {step === 'code' ? 'Другой адрес' : 'Назад'}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {step !== 'choose' && back}

      {step === 'choose' && (
        <>
          <button
            type="button"
            onClick={() => go('new')}
            className="sk-btn sk-btn-primary sk-plinth sk-press sk-btn-block"
          >
            Завести аккаунт
          </button>
          <button
            type="button"
            onClick={() => go('back')}
            className="sk-btn sk-btn-outline sk-press sk-btn-block"
          >
            Я уже был здесь
          </button>
        </>
      )}

      {step === 'new' && (
        <>
          {addressField}
          {passwordField(true)}
          <button
            type="button"
            onClick={() => void register()}
            disabled={busy || !addressOk || !passwordOk}
            className="sk-btn sk-btn-primary sk-plinth sk-press sk-btn-block"
          >
            {busy ? 'Завожу…' : 'Завести аккаунт'}
          </button>
        </>
      )}

      {step === 'back' && (
        <>
          {addressField}
          {passwordField(false)}
          <button
            type="button"
            onClick={() => void enter()}
            disabled={busy || !addressOk || password.length === 0}
            className="sk-btn sk-btn-primary sk-plinth sk-press sk-btn-block"
          >
            {busy ? 'Вхожу…' : 'Войти'}
          </button>
          {/* Одна кнопка на два случая, и это нарочно: забывший пароль и заведший аккаунт до того,
              как пароли появились, приходят сюда за одним и тем же письмом. «Забыл пароль» второму
              из них говорило бы, что у него есть пароль, который он забыл. */}
          <button
            type="button"
            onClick={() => void byCode()}
            disabled={busy || !addressOk}
            className="sk-btn sk-btn-ghost sk-press sk-btn-block"
          >
            Войти по коду из письма
          </button>
        </>
      )}

      {step === 'code' && (
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
        </>
      )}

      {note !== null && <p className="text-[13px] text-text-secondary">{note}</p>}

      {error && (
        <p className="text-[13px]" style={{ color: 'var(--color-day-red)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
