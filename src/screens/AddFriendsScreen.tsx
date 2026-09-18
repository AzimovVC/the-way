import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import PersonRow from '../components/PersonRow'
import { handleOf, normalizeHandle } from '../domain/handle'
import { inviteLink } from '../social/client'
import type { Acquaintance } from '../social/client'
import { useSocial } from '../social/socialState'
import { useAppState } from '../state/appState'

/** Сколько ждать после последней буквы. Достаточно, чтобы не спрашивать на каждую, и незаметно. */
const TYPING_PAUSE_MS = 250

/**
 * Где находят людей.
 *
 * Два пути, и они отвечают на разные вопросы. **Поиск по нику** — для друга, который уже здесь:
 * ник говорят вслух, как номер телефона, и по нему попадают точно в человека. **Ссылка** — для
 * того, кого здесь ещё нет; она не ищет, она зовёт.
 *
 * Поиска по имени нет намеренно — см. `SocialClient.search`: различить двух тёзок нам нечем, а
 * цена ошибки — заявка чужому человеку.
 */
export default function AddFriendsScreen() {
  const { state } = useAppState()
  const { client, view } = useSocial()
  const myHandle = handleOf(state.user)

  const [query, setQuery] = useState('')
  // Ответ вместе с тем, **на какой** запрос он ответ. Отсюда выводится «ищу»: пока пришедшее
  // относится к другому набору букв, ответа на нынешний ещё нет. Отдельного флага нет намеренно —
  // он неизбежно разошёлся бы с полем на отменённом запросе и оставил бы «Ищу…» навсегда.
  const [answer, setAnswer] = useState<{ query: string; items: Acquaintance[] } | null>(null)
  const [suggestions, setSuggestions] = useState<Acquaintance[]>([])
  const [copied, setCopied] = useState(false)

  const needle = query.trim()
  const found = answer !== null && answer.query === needle ? answer.items : null
  const searching = needle.length > 0 && found === null

  // Поиск идёт после паузы в наборе, а не на каждую букву: иначе «lena» — это четыре запроса,
  // три из которых отвечают про то, чего человек уже не спрашивает.
  useEffect(() => {
    if (needle.length === 0) return

    let alive = true
    const timer = setTimeout(() => {
      client
        .search(needle)
        .then((items) => {
          if (alive) setAnswer({ query: needle, items })
        })
        .catch(() => {
          if (alive) setAnswer({ query: needle, items: [] })
        })
    }, TYPING_PAUSE_MS)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [needle, client])

  // Предложения перечитываются, когда меняются связи: позвавший человека не должен видеть его
  // среди «кого можно позвать» ещё минуту.
  useEffect(() => {
    let alive = true
    client
      .suggestions()
      .then((result) => {
        if (alive) setSuggestions(result)
      })
      .catch(() => {
        if (alive) setSuggestions([])
      })
    return () => {
      alive = false
    }
  }, [client, view])

  const share = useCallback(() => {
    const url = inviteLink(myHandle)
    const text = `Идём вместе? Мой ник в The Way — @${myHandle}`
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      void navigator.share({ title: 'The Way', text, url }).catch(() => {
        // Человек закрыл системное окно — это не ошибка и говорить о ней нечего.
      })
      return
    }
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [myHandle])

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <Link to="/profile/friends" aria-label="Назад к друзьям" className="sk-press sk-focus -ml-2 rounded-[16px] p-2">
            <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
          </Link>
          <h1 className="sk-heading text-[32px] text-text-primary">Найти друзей</h1>
        </div>

        <section className="flex flex-col gap-3">
          {/* Поле, а не строка «Поиск по нику», открывающая ещё один экран: это главный путь
              сюда, и лишний тап стоит на нём каждый раз. */}
          <label
            className="flex items-center gap-2 rounded-[16px] border border-border px-3"
            style={{ backgroundColor: 'var(--color-surface-raised)' }}
          >
            <span className="text-[16px] font-semibold text-text-muted">@</span>
            <input
              value={query}
              onChange={(e) => setQuery(normalizeHandle(e.target.value))}
              placeholder="ник друга"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Ник друга"
              className="sk-focus min-h-[48px] flex-1 rounded-[12px] bg-transparent text-[16px] text-text-primary placeholder:text-text-muted"
            />
            {query.length > 0 && (
              <button type="button" onClick={() => setQuery('')} aria-label="Очистить" className="sk-press sk-focus p-1">
                <Icon name="x" size={18} color="var(--color-text-muted)" />
              </button>
            )}
          </label>

          {searching && <p className="text-[13px] text-text-muted">Ищу…</p>}

          {!searching && found !== null && found.length === 0 && (
            <p className="text-[13px] text-text-muted">
              Никого с таким ником. Ник набирается целиком — это не поиск по имени.
            </p>
          )}

          {!searching && found !== null && found.length > 0 && (
            <div className="flex flex-col gap-2">
              {found.map(({ person, state: link }) => (
                <PersonRow key={person.id} person={person} state={link} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={share}
            className="sk-press sk-focus flex items-center gap-3 rounded-[20px] border border-border p-3.5 text-left"
            style={{ backgroundColor: 'var(--color-surface-raised)' }}
          >
            <Icon name="user-plus" size={22} color="var(--color-brand)" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-bold text-text-primary">
                {copied ? 'Ссылка скопирована' : 'Позвать ссылкой'}
              </span>
              <span className="truncate text-[13px] text-text-muted">@{myHandle}</span>
            </span>
            <Icon name="chevron-right" size={18} color="var(--color-text-muted)" />
          </button>

          {/* Контакты телефона браузеру не видны: это уйдёт в приложение, когда оно станет
              приложением. Строка стоит дымчатой и подписанной — ряд «скоро» в настройках сделан
              так же, и мёртвая кнопка без подписи врала бы про то, что приложение умеет. */}
          <div
            className="flex items-center gap-3 rounded-[20px] border border-border p-3.5"
            style={{ backgroundColor: 'var(--color-surface-raised)', opacity: 0.5 }}
          >
            <Icon name="users" size={22} color="var(--color-text-muted)" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-bold text-text-primary">Из контактов</span>
              <span className="text-[13px] text-text-muted">Появится в приложении для телефона</span>
            </span>
            <span className="sk-eyebrow" style={{ color: 'var(--ink-400)' }}>скоро</span>
          </div>
        </section>

        {/* Пока в поле что-то набрано, предложений нет: найденный человек стоял бы на экране
            дважды — один раз ответом на вопрос, другой раз догадкой. */}
        {needle.length === 0 && suggestions.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="sk-eyebrow">Может быть, знакомы</h2>
            <div className="flex flex-col gap-2">
              {suggestions.map(({ person, state: link }) => (
                <PersonRow key={person.id} person={person} state={link} />
              ))}
            </div>
          </section>
        )}

        <p className="text-[12px] text-text-muted">
          Настоящих людей здесь пока нет: сеть ещё не подключена, и заявка никуда не уходит.
        </p>
      </div>
    </AppShell>
  )
}
