import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import RankBadge from '../components/RankBadge'
import StatTile from '../components/StatTile'
import { dayWord, habitWord } from '../domain/calendar'
import { formatHandle } from '../domain/handle'
import { rankReachedAt } from '../domain/ranks'
import { inviteLink } from '../social/client'
import type { Acquaintance } from '../social/client'
import type { Person, PersonHabit } from '../social/types'
import { useSocial } from '../social/socialState'

/**
 * Чужой профиль — то, куда ведут строки списков и ссылка-приглашение.
 *
 * Он устроен как **свой**: тот же баннер, тот же ник строкой под ним, тот же «Обзор» теми же
 * плитками. Два профиля в одном приложении — одна вещь, и экран, собранный по-другому, читался бы
 * как другое место, хотя отвечает на тот же вопрос про другого человека.
 *
 * Показывается ровно то, что прислала та сторона. Решать, что чужому видно, а что нет, — работа
 * сервера: у нас нет ни его дней, ни права их спрашивать, и клиент, скрывающий поля по своему
 * усмотрению, делал бы вид, что защищает то, что ему уже отдали.
 *
 * Дороги здесь нет и не будет. Дорога — запись человека о себе, она читается вместе с карточками
 * дней и метками изменений, и чужой, листающий её, судил бы прожитую не им жизнь по картинке.
 * Числа — другое дело: они про него и рассказаны им самим.
 *
 * Чего здесь нет намеренно — **сравнения**. У Duolingo на этом месте стоит график «ты и он» в
 * одних очках; это лига на двоих, где один всегда внизу, и линейка из ideas.md отвечает на неё
 * «да, чужое существование делает тебе хуже про уже прожитый день».
 */
export default function PersonScreen() {
  const { handle = '' } = useParams()
  const navigate = useNavigate()
  const { client, view, busy, request, cancel, accept, decline, remove } = useSocial()

  const [found, setFound] = useState<Acquaintance | null | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)

  // Перечитывается вместе со связями: принявший заявку должен увидеть «вы друзья» здесь же, а не
  // после возвращения на список.
  useEffect(() => {
    let alive = true
    client
      .profile(handle)
      .then((result) => {
        if (alive) setFound(result)
      })
      .catch(() => {
        if (alive) setFound(null)
      })
    return () => {
      alive = false
    }
  }, [client, handle, view])

  // Делятся **его** ссылкой, а не своей: человек, стоящий на чужом профиле, показывает друга
  // третьему, а не зовёт к себе. Своя ссылка живёт там, где зовут, — на экране поиска.
  const share = useCallback(() => {
    const url = inviteLink(handle)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      void navigator.share({ title: 'The Way', text: `Он идёт в The Way — @${handle}`, url }).catch(() => {
        // Человек закрыл системное окно — это не ошибка и говорить о ней нечего.
      })
      return
    }
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [handle])

  const person = found === undefined || found === null ? null : found.person
  // Самая давняя впереди — тем же порядком, что и своя витрина. Порядок, пришедший с той стороны,
  // однажды окажется другим, и полка у двух людей читалась бы по-разному.
  const habits = [...(person?.habits ?? [])].sort((a, b) => b.days - a.days)

  return (
    <AppShell scrollable>
      {/* Баннер идёт до краёв рамки, поэтому поля экрана начинаются под ним — как в своём профиле. */}
      <div className="flex flex-col gap-6 pb-6">
        <header className="flex flex-col">
          <div
            className="flex flex-col items-center gap-5 px-4 pb-7 pt-5"
            style={{ backgroundColor: 'var(--violet-700)' }}
          >
            <div className="flex w-full items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Назад"
                className="sk-press sk-focus -ml-2 shrink-0 rounded-[16px] p-1"
              >
                <Icon name="chevron-left" size={26} color="var(--ink-100)" />
              </button>
              <h1 className="sk-heading min-w-0 flex-1 truncate text-[28px] text-text-primary">
                {person?.name ?? ''}
              </h1>
              {person !== null && (
                <button
                  type="button"
                  onClick={share}
                  aria-label="Поделиться профилем"
                  className="sk-press sk-focus -mr-1 shrink-0 rounded-[16px] p-1"
                >
                  <Icon name="share" size={24} color="var(--ink-100)" />
                </button>
              )}
            </div>

            {/* Тот же круг, что в своём профиле: фотографий в этом приложении нет, и буква стоит
                там, где однажды встанет картинка. */}
            {person === null ? (
              <div
                className="grid size-[132px] place-items-center rounded-full"
                style={{ backgroundColor: 'var(--violet-800)', boxShadow: 'inset 0 0 0 3px var(--violet-600)' }}
                aria-hidden
              >
                <Icon name="user" size={64} color="var(--violet-500)" />
              </div>
            ) : (
              <Avatar name={person.name} size={132} ring />
            )}
          </div>

          {person !== null && <p className="sk-eyebrow px-4 pt-5">{formatHandle(person.handle)}</p>}
        </header>

        <div className="flex flex-col gap-6 px-4">
          {found === undefined && <p className="text-[13px] text-text-muted">Загружаю…</p>}

          {found === null && (
            <p className="text-[13px] text-text-muted">
              Никого с ником @{handle}. Ник набирается целиком — это не поиск по имени.
            </p>
          )}

          {found !== undefined && found !== null && (
            <>
              {/* Единственное число про чужого человека, которое здесь законно: не «сколько у него
                  друзей» — это популярность и шкала, — а ответ на вопрос, который правда задают,
                  глядя на незнакомый ник: кто это и откуда я его знаю. Стоит над кнопкой, потому
                  что решение «звать или нет» принимают по нему. */}
              {found.mutual !== undefined && found.mutual.length > 0 && <Mutual people={found.mutual} />}

              {/* Кнопка стоит выше чисел, как у Duolingo: пришедший по ссылке пришёл звать или
                  отвечать, а не читать статистику. */}
              <div className="flex flex-col gap-2">
                {found.state === 'none' && (
                  <button
                    type="button"
                    onClick={() => void request(found.person.id)}
                    disabled={busy.has(found.person.id)}
                    className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus"
                  >
                    <Icon name="user-plus" size={21} color="var(--color-text-on-brand)" />
                    Позвать в друзья
                  </button>
                )}

                {found.state === 'outgoing' && (
                  <>
                    <p className="text-center text-[13px] text-text-muted">Заявка отправлена</p>
                    <button
                      type="button"
                      onClick={() => void cancel(found.person.id)}
                      disabled={busy.has(found.person.id)}
                      className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus"
                    >
                      Отменить заявку
                    </button>
                  </>
                )}

                {found.state === 'incoming' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void accept(found.person.id)}
                      disabled={busy.has(found.person.id)}
                      className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus"
                    >
                      Принять заявку
                    </button>
                    <button
                      type="button"
                      onClick={() => void decline(found.person.id)}
                      disabled={busy.has(found.person.id)}
                      className="sk-btn sk-btn-ghost sk-btn-block sk-press sk-focus"
                    >
                      Отклонить
                    </button>
                  </>
                )}

                {/* Кто он тебе, говорит сама кнопка — как «FOLLOWING» у Duolingo. Отдельная строка
                    «Вы друзья» над кнопкой, которая это же и написала бы, была бы тем же фактом
                    дважды. Нажатие ничего не снимает: убирают в два шага, потому что дружбу
                    складывали вдвоём, и промах по кнопке не должен её стоить. */}
                {found.state === 'friends' &&
                  (confirming ? (
                    <>
                      <p className="text-center text-[13px] text-text-muted">
                        Убрать {found.person.name} из друзей?
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirming(false)
                          void remove(found.person.id)
                        }}
                        disabled={busy.has(found.person.id)}
                        className="sk-btn sk-btn-danger sk-btn-block sk-plinth sk-focus"
                      >
                        Убрать
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        className="sk-btn sk-btn-ghost sk-btn-block sk-press sk-focus"
                      >
                        Оставить
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      style={{ ['--plinth-color' as string]: 'var(--color-border)' }}
                      className="sk-btn sk-btn-outline sk-btn-block sk-plinth sk-focus"
                    >
                      <Icon name="users" size={21} color="var(--color-text-primary)" />
                      Вы друзья
                    </button>
                  ))}

                {copied && <p className="text-center text-[12px] text-text-muted">Ссылка скопирована</p>}
              </div>

              {/* Те же плитки и те же слова, что в своём «Обзоре»: один и тот же факт, названный
                  на двух экранах по-разному, читается как два разных. */}
              <section className="flex flex-col gap-3">
                <h2 className="sk-eyebrow">Обзор</h2>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  {found.person.daysOnRoad !== undefined && (
                    <StatTile
                      icon="flag"
                      color="var(--color-day-green)"
                      text={`${found.person.daysOnRoad} ${dayWord(found.person.daysOnRoad)} в пути`}
                    />
                  )}
                  {found.person.currentStreak !== undefined && (
                    <StatTile
                      icon="flame"
                      color="var(--color-streak-flame)"
                      text={`${found.person.currentStreak} ${dayWord(found.person.currentStreak)} подряд`}
                    />
                  )}
                  {/* Плитка с числом привычек стоит, только пока полки нет: под полкой она
                      пересчитывала бы медали, стоящие в двух сантиметрах ниже. Число не пропадает
                      — оно уходит в заголовок полки, как в своём профиле. */}
                  {found.person.habitCount !== undefined && habits.length === 0 && (
                    <StatTile
                      icon="list-checks"
                      color="var(--color-brand)"
                      text={`${found.person.habitCount} ${habitWord(found.person.habitCount)}`}
                    />
                  )}
                </div>
              </section>

              {/* Та же полка, что у себя, и по той же причине: какие привычки есть и докуда каждая
                  дошла — это про человека, а не про то, кто из вас дальше. Пустой рамки «скоро
                  здесь будет» тут нет: у начавшего вчера полка уже полная, просто медали на ней
                  пустые, а обещание — это долг, который приложение берёт на себя без спроса. */}
              {habits.length > 0 && (
                <section className="flex flex-col gap-3">
                  <div className="flex items-center gap-1">
                    <h2 className="sk-eyebrow flex-1">Достижения</h2>
                    <span className="sk-num text-[12px] text-text-muted">{habits.length}</span>
                  </div>
                  <PersonShelf habits={habits} />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

/**
 * Общие друзья одной строкой. Имена стоят в именительном падеже — «Общие друзья — Лена и Олег», —
 * потому что склонять их нечем: «с Леной» требует знать, как имя устроено, а имя человек пишет
 * какое хочет, включая «kate», «Ди» и «Мама».
 */
function Mutual({ people }: { people: Person[] }) {
  const shown = people.slice(0, 2)
  const rest = people.length - shown.length
  const names = shown.map((p) => p.name).join(', ')

  return (
    <div className="flex items-center gap-3">
      {/* Кружки внахлёст — это один знак «люди», а не список: список стоит справа словами. */}
      <span className="flex shrink-0 items-center">
        {people.slice(0, 3).map((p, i) => (
          <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
            <Avatar name={p.name} size={28} ring />
          </span>
        ))}
      </span>
      <p className="min-w-0 flex-1 text-[13px] text-text-muted">
        <span className="text-text-secondary">{people.length === 1 ? 'Общий друг' : 'Общие друзья'}</span>
        {' — '}
        {rest > 0 ? `${names} и ещё ${rest}` : names}
      </p>
    </div>
  )
}

/**
 * Полка чужих привычек: медаль на привычку, название под ней.
 *
 * Медали не нажимаются, и `+N` под ними нет. У себя «+3» — это дверь на экран с датами и полосами;
 * про чужую привычку такого экрана нет и не будет, а неработающая плитка «+3» была бы счётчиком
 * того, что от тебя спрятали. Поэтому встают все: привычек у человека единицы, а рядов — два.
 */
function PersonShelf({ habits }: { habits: PersonHabit[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {habits.map((habit) => (
        <div key={habit.id} className="flex min-w-0 flex-col items-center gap-2 p-1">
          <RankBadge
            rank={rankReachedAt(habit.days)?.id ?? null}
            days={habit.days}
            letter={habit.title.trim().slice(0, 1).toUpperCase()}
            glyph={habit.icon}
          />
          <span className="w-full truncate text-center text-[11px] text-text-muted">{habit.title}</span>
        </div>
      ))}
    </div>
  )
}
