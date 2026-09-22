import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import SettingsRow from '../components/SettingsRow'
import SettingsSection from '../components/SettingsSection'
import { formatHandle } from '../domain/handle'
import { useAuth } from '../supabase/authState'

/**
 * Аккаунт: почта, ник, выход и удаление.
 *
 * **Пароля здесь больше нет**, и это не перенос поля, а следствие решения о единственной двери:
 * входят через Google, а у него пароля нет — менять нечего. Ушёл вместе с полем и весь разговор
 * про «поставить или сменить», который был честен ровно пока дверей было три.
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
              {/* Почта приехала от Google вместе с сессией и здесь только показывается: менять
                  её отсюда нечем и незачем — она принадлежит тому аккаунту, которым человек
                  вошёл, и правится там же, где он его завёл. */}
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

            <DeleteSection />
          </>
        )}
      </div>
    </AppShell>
  )
}

/**
 * Удаление аккаунта. Стоит **последним на экране** и последним же в приложении: до него доходят,
 * пролистав почту, ник и выход, — и это единственная защита, которая работает всегда, в
 * отличие от любого предупреждения.
 *
 * Два шага, и второй просит **набрать слово**, а не нажать «точно?». Второе нажатие делается той
 * же рукой и тем же движением, что первое, — пальцем, который уже решил; набранное слово требует
 * прочитать, что написано рядом. Слово обычное, `удалить`: имя аккаунта, которое пришлось бы
 * искать глазами выше, добавляет возни, но не раздумья.
 *
 * Цена названа до кнопки и целиком, включая то, чего **не** случится: дорога останется на этом
 * телефоне. Человек, удаляющий аккаунт, обычно боится потерять историю — и ему честнее сказать
 * это сразу, чем заставить выбирать между ником и своим путём.
 */
const CONFIRM_WORD = 'удалить'

function DeleteSection() {
  const { deleteAccount } = useAuth()
  const [asked, setAsked] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)

  if (!asked) {
    return (
      <SettingsSection title="Опасное">
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-[13px] text-text-muted">
            Удаление уносит аккаунт целиком: ник освободится, друзья пропадут, копия пути на
            сервере сотрётся. Вернуть это нельзя. Дорога на этом телефоне останется.
          </p>
          <button
            type="button"
            onClick={() => setAsked(true)}
            className="sk-btn sk-btn-ghost sk-press sk-btn-block"
            style={{ color: 'var(--color-day-red)' }}
          >
            Удалить аккаунт
          </button>
        </div>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection title="Опасное">
      <div className="flex flex-col gap-3 px-4 py-4">
        {/* Совет про копию стоит **здесь**, а не в первом шаге: на первом человек ещё выбирает, а
            на втором уже собрался — и это последняя минута, когда копию можно успеть забрать. */}
        <p className="text-[13px] text-text-secondary">
          Набери <span className="font-semibold text-text-primary">{CONFIRM_WORD}</span>, чтобы
          подтвердить. Если хочешь сохранить путь файлом — сделай это сейчас, в настройках, кнопкой
          «Сохранить копию».
        </p>
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={CONFIRM_WORD}
          aria-label={`Набери ${CONFIRM_WORD}`}
          className="sk-focus w-full rounded-[12px] border border-border bg-transparent px-3 py-2.5 text-[15px] text-text-primary placeholder:text-text-muted"
        />
        <button
          type="button"
          onClick={() => {
            setBusy(true)
            void deleteAccount().then((gone) => {
              // Удалось — экран исчезает вместе с сессией: дверь перед приложением встаёт сама.
              // Не удалось — беда уже лежит выше, и человек остаётся с аккаунтом и с кнопкой.
              if (!gone) setBusy(false)
            })
          }}
          disabled={busy || word.trim().toLowerCase() !== CONFIRM_WORD}
          className="sk-btn sk-btn-danger sk-press sk-btn-block"
        >
          {busy ? 'Удаляю…' : 'Удалить навсегда'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAsked(false)
            setWord('')
          }}
          className="sk-btn sk-btn-ghost sk-press sk-btn-block"
        >
          Оставить всё как есть
        </button>
      </div>
    </SettingsSection>
  )
}
