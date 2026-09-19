import type { ReactNode } from 'react'
import SignInForm from '../SignInForm'
import Icon from '../Icon'
import { isEmptyRoad } from '../../storage/roadPlan'
import { useAppState } from '../../state/appState'
import { useAuth } from '../../supabase/authState'

/**
 * Дверь перед приложением: без аккаунта дальше не идут.
 *
 * **Раньше было наоборот**, и это решение переменилось нарочно. Вход стоял строкой в настройках,
 * потому что дорога живёт на телефоне и работает без сети; из этого следовало, что аккаунт нужен
 * «для другого» и просить его вперёд незачем. Верным оказалось только первое. Приложение выросло в
 * социальное — друзья, кружок, лента, — и в нём аккаунт перестал быть страховкой для истории: это
 * то, чем человека зовут. Пока его нет, ник у человека **выдуманный**: `handleOf` подбирает его по
 * имени, и он не занят никем, так что двое ходят под одним ником, пока один из них не войдёт.
 * Ссылка-приглашение на такой ник зовёт в никуда, а каждый социальный экран вынужден быть особым
 * случаем — «а что показать тому, кого здесь нет».
 *
 * Цена названа честно: **новый человек без сети внутрь не попадёт**. Уже вошедший попадёт — сессия
 * лежит на диске и поднимается без единого запроса, поэтому день, отмеченный в метро, по-прежнему
 * не теряется, и дорога по-прежнему пишется в localStorage первой. Гарантию PWA это не отменяет:
 * она про то, чтобы не потерять свою жизнь, а не про первую минуту у незнакомого человека.
 *
 * Без сервера (`configured === false`, нет ключей в `.env.local`) двери нет вовсе. Запереть
 * приложение за дверью, которая никуда не ведёт, значило бы сломать его совсем — а с ним и
 * разработку.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { configured, status } = useAuth()
  const { state } = useAppState()

  if (!configured || status === 'signed-in') return <>{children}</>

  // Сессия поднимается с диска асинхронно, и это **третье** состояние, а не «не вошёл»: дверь,
  // мигнувшая в первый кадр перед вошедшим человеком, читается как «тебя разлогинило».
  if (status === 'loading') {
    return (
      <Shell>
        <p className="text-[13px] text-text-muted">Загружаю…</p>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div
          className="grid size-24 place-items-center rounded-full"
          style={{ backgroundColor: 'var(--color-brand)', boxShadow: '0 6px 0 var(--color-brand-plinth)' }}
        >
          <Icon name="flag" size={44} color="var(--color-text-on-brand)" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="sk-heading text-[26px] text-text-primary">Здесь идут не в одиночку</h2>
          <p className="text-[15px] text-text-secondary">
            Аккаунт даёт ник, по которому тебя найдут друзья, и хранит копию пути — чтобы он пережил
            потерянный телефон. Нужны почта и пароль.
          </p>
        </div>

        {/* Сказано **до** входа и только тому, кому это правда важно: человеку с историей на этом
            телефоне. «Твои данные в безопасности» на пустом устройстве — обещание в воздух, а вот
            тот, у кого за дверью осталась дорога, имеет право узнать её судьбу раньше, чем введёт
            почту. */}
        {!isEmptyRoad(state) && (
          <p className="text-[13px] text-text-muted">
            Путь, который уже есть на этом телефоне, никуда не делся. После входа он уедет в
            аккаунт целиком.
          </p>
        )}

        <div className="w-full text-left">
          <SignInForm />
        </div>
      </div>
    </Shell>
  )
}

/** Та же рамка, что у онбординга: это соседние минуты одной дороги, а не два разных приложения. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-surface-sunken">
      <div className="relative flex w-full max-w-[390px] flex-col gap-6 bg-bg px-4 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="sk-heading text-[32px] text-text-primary">The Way</h1>
        </header>
        {children}
      </div>
    </div>
  )
}
