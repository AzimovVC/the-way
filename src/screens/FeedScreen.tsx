import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Avatar from '../components/Avatar'
import ComebackHero from '../components/ComebackHero'
import Icon, { type IconName } from '../components/Icon'
import RankBadge from '../components/RankBadge'
import { comebackRank } from '../domain/comeback'
import { dayWord, daysBetween, formatLongDate } from '../domain/calendar'
import {
  buildFeed,
  feedEventId,
  feedSince,
  feedSinceDays,
  type FeedDay,
  type FeedEntry,
} from '../domain/feed'
import { heartsOn, type FriendEvent } from '../social/feed'
import { useSocial } from '../social/socialState'
import { useAuth } from '../supabase/authState'
import { getLogicalToday } from '../domain/pathEngine'
import { rankLabel } from '../domain/ranks'
import { useAppState } from '../state/appState'

/** What the calendar marks are called in a sentence — the road's own badges say «1М» and «ПОЛГОДА». */
const CALENDAR_TITLE = {
  start: 'Начало пути',
  month: 'Месяц на дороге',
  halfYear: 'Полгода на дороге',
  year: 'Год на дороге',
} as const

const CALENDAR_NOTE = {
  start: 'Здесь всё началось.',
  month: 'Тридцать дней позади.',
  halfYear: 'Сто восемьдесят два дня позади.',
  year: 'Год позади.',
} as const

function dayTitle(date: string, today: string): string {
  const back = daysBetween(date, today)
  if (back === 0) return 'Сегодня'
  if (back === 1) return 'Вчера'
  return formatLongDate(date)
}

/** A round plinth-less disc with a glyph — the slot the habit events fill with their medal. */
function EventDisc({ icon, color }: { icon: IconName; color: string }) {
  return (
    <div
      className="grid size-11 shrink-0 place-items-center rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      <Icon name={icon} size={22} color="var(--ink-950)" />
    </div>
  )
}

/**
 * Сердце и лица тех, кто его сказал.
 *
 * Лица, а не число, и это не украшение: своему событию сердце поставить **можно**, то есть счёт
 * накручиваем. Лица эту цену снимают — своё лицо среди двух чужих никого не обманывает, а «3»
 * обманывает. Заодно они отвечают на вопрос, который число не отвечает: кто именно.
 *
 * Строки нет вовсе, пока сердец нет и своё не сказано: пустой ряд под каждым событием — это счёт,
 * показывающий ноль, а нулей в этом приложении не рисуют.
 */
function Hearts({
  people,
  mine,
  onToggle,
}: {
  people: string[]
  mine: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-2 pl-1">
      <button
        type="button"
        onClick={onToggle}
        aria-label={mine ? 'Забрать сердце' : 'Сказать сердце'}
        aria-pressed={mine}
        className="sk-press sk-focus -m-1.5 rounded-full p-1.5"
      >
        <Icon
          name={mine ? 'heart-filled' : 'heart'}
          size={20}
          color={mine ? 'var(--color-day-red)' : 'var(--color-text-muted)'}
        />
      </button>
      {/* Лица стоят внахлёст, как везде, где их несколько: ряд из пяти отдельных кружков читается
          как список людей, а это одна мысль — «вот кто». */}
      {people.length > 0 && (
        <div className="flex items-center">
          {people.map((name, i) => (
            <Avatar
              key={`${name}-${i}`}
              name={name}
              size={22}
              className={i === 0 ? '' : '-ml-1.5'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * One loud event of your own, as a card.
 *
 * The shape is Duolingo's feed row — a round mark on the left, a line of news, a quiet second line.
 * Under it stands the heart, when the event is one friends can see: an event nobody else is shown
 * cannot be applauded, and a heart button over it would be the app clapping into an empty room.
 */
function LoudCard({ entry, onOpen }: { entry: FeedEntry; onOpen: () => void }) {
  const { event } = entry

  let mark = <EventDisc icon="flag" color="var(--color-brand)" />
  let title = ''
  let note = ''
  let hero: React.ReactNode = null

  if (event.kind === 'calendar') {
    title = CALENDAR_TITLE[event.mark]
    note = CALENDAR_NOTE[event.mark]
  } else if (event.kind === 'goal') {
    mark = <EventDisc icon="flag" color="var(--cobalt-500)" />
    title = `Новая привычка — «${event.title}»`
    note = 'С этого дня дорога её считает.'
  } else if (event.kind === 'rank') {
    mark = (
      <RankBadge rank={event.rank} size={44} letter={event.title.trim().slice(0, 1).toUpperCase()} />
    )
    title = `${rankLabel({ id: event.rank, days: event.days, year: Math.max(1, Math.floor(event.days / 365)) })} — «${event.title}»`
    note = `Ты держишь её уже ${event.days} ${dayWord(event.days)}.`
  } else if (event.kind === 'comeback') {
    mark = <EventDisc icon="trending-up" color="var(--color-day-green)" />
    // The rank word is the headline when there is one; the plain word stands in on the returns
    // between ranks. Neither says who came back: the app does not know, and the row is about the
    // road anyway.
    title = comebackRank(event.comeback.ordinal) ?? 'Возвращение'
    note = `${event.comeback.slumpLength} ${dayWord(event.comeback.slumpLength)} вниз, потом ${event.comeback.returnLength} вверх.`
    hero = <ComebackHero shape={event.comeback.shape} size="inline" track="var(--color-surface-sunken)" />
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="sk-press sk-focus flex w-full flex-col gap-2 rounded-[20px] border border-border p-3.5 text-left"
      style={{ backgroundColor: 'var(--color-surface-raised)' }}
    >
      <div className="flex w-full items-center gap-3">
        {mark}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-bold text-text-primary">{title}</span>
          <span className="text-[13px] text-text-muted">{note}</span>
        </div>
        <Icon name="chevron-right" size={18} color="var(--color-text-muted)" />
      </div>
      {/* The stretch of road itself, when there is one: «спад 5, вверх 3» says the same thing and
          shows nothing, and the shape is what the person recognises. */}
      {hero}
    </button>
  )
}

/**
 * Событие друга.
 *
 * Та же строка, что и своя, с одной разницей: слева стоит **человек**, а не медаль. Это и есть
 * всё, что отличает половины одной ленты, — и этого хватает, потому что аватар фиолетовый, а
 * фиолетовый в этом приложении значит «человек» и больше ничего.
 *
 * Карточка не нажимается: за ней нет дня, который можно открыть. Чужая дорога не читается никем,
 * включая друзей, и стрелка «дальше» обещала бы экран, которого нет.
 */
function FriendCard({ event }: { event: FriendEvent }) {
  const who = event.person.name.trim() === '' ? `@${event.person.handle}` : event.person.name

  let line = ''
  let note = ''
  if (event.kind === 'rank') {
    const days = event.days ?? 0
    line = `${who}: ${rankLabel({ id: event.rank ?? 'novice', days, year: Math.max(1, Math.floor(days / 365)) })} — «${event.title}»`
    note = `${days} ${dayWord(days)} с этой привычкой.`
  } else if (event.kind === 'goal') {
    line = `${who}: новая привычка — «${event.title}»`
    note = 'Первый день.'
  } else {
    line = `${who}: ${CALENDAR_TITLE[event.mark ?? 'start'].toLowerCase()}`
    note = CALENDAR_NOTE[event.mark ?? 'start']
  }

  return (
    <div
      className="flex w-full items-center gap-3 rounded-[20px] border border-border p-3.5"
      style={{ backgroundColor: 'var(--color-surface-raised)' }}
    >
      <Avatar name={who} size={44} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Подпись про человека — **без глагола**: «Лена: Ученик», а не «Лена взяла Ученика».
            Глагол в русском выдаёт род, а его человек здесь нигде не называл. */}
        <span className="text-[15px] font-bold text-text-primary">{line}</span>
        <span className="text-[13px] text-text-muted">{note}</span>
      </div>
    </div>
  )
}

/** A quiet event: one line, no card. Yours only — friends' feeds carry no service notes. */
function QuietLine({ entry }: { entry: FeedEntry }) {
  const { event } = entry
  if (event.kind === 'freeze') {
    return (
      <p className="flex items-center gap-2 pl-1 text-[13px] text-text-muted">
        <Icon name="moon" size={14} color="var(--color-freeze)" />
        Заморозка удержала день
      </p>
    )
  }
  if (event.kind !== 'taskChange') return null

  const { change } = event
  const icon: IconName = change.kind === 'added' ? 'plus' : change.kind === 'removed' ? 'minus' : 'calendar'
  const what =
    change.kind === 'added' ? 'Добавил привычку' : change.kind === 'removed' ? 'Убрал привычку' : 'Поменял расписание'

  return (
    <p className="flex items-center gap-2 pl-1 text-[13px] text-text-muted">
      <Icon name={icon} size={14} color={change.kind === 'added' ? 'var(--cobalt-500)' : 'var(--color-text-muted)'} />
      {what} — «{change.title}»
    </p>
  )
}

/**
 * Лента — одна, и это её главное свойство.
 *
 * Вкладок «Ты» и «Друзья» нет. Feed отвечает на один вопрос — «что происходит», — и человек не
 * должен выбирать вкладку, чтобы его задать. Ломалось это ровно в одном месте: своя лента уходила
 * на месяцы назад, а чужие события важны только свежие, и смешанные как есть они поставили бы её
 * вчерашнюю ступень между твоим мартом и апрелем. Ответ — **одна глубина на обоих**
 * (`FEED_WINDOW_DAYS`), а не две вкладки.
 *
 * Свой глубокий архив при этом не потерян: он и есть дорога, где каждый день — круг, на который
 * можно нажать, плюс архив недель по значкам и экраны месяцев. Лента, уходившая на полгода назад,
 * пересказывала дорогу другими словами.
 *
 * Свою половину экран **выводит сам** ([feed.ts](../domain/feed.ts)), из дней, лежащих на
 * телефоне, — где она богаче и где она есть без сети. Чужая приезжает с сервера, и сердца вместе с
 * ней, в том числе на свои события: их ставит та сторона, и знать о них отсюда неоткуда.
 */
export default function FeedScreen() {
  const { state } = useAppState()
  const { userId } = useAuth()
  const { view, feed: social, heart, unheart } = useSocial()
  const navigate = useNavigate()

  const today = getLogicalToday(new Date())
  const since = feedSince(today)
  // Дорога читается целиком, а окно накладывается снаружи: `buildFeed` — единственное дорогое
  // место на экране, и вешать на него ещё и сегодняшнюю дату значило бы пересчитывать всю историю
  // при каждом переходе через 3:00.
  const road: FeedDay[] = useMemo(() => buildFeed(state), [state])
  const mine: FeedDay[] = feedSinceDays(road, since)

  /**
   * Имя к ключу человека. Сердце приезжает ключом, а рисуется лицом, и взять имя больше неоткуда:
   * друзья уже лежат в контексте, а своё имя — в собственном профиле. Чужого имени, которого нет
   * в друзьях, здесь не бывает: сердце видно только тому, кому видно событие.
   */
  const names = useMemo(() => {
    const map = new Map<string, string>()
    for (const person of view.friends) map.set(person.id, person.name.trim() || `@${person.handle}`)
    if (userId !== null) map.set(userId, state.user.name.trim() || 'Ты')
    return map
  }, [view.friends, userId, state.user.name])

  /**
   * Дни ленты — объединение своих и чужих, сверху вниз.
   *
   * День, в котором есть только чужое событие, здесь тоже есть: лента одна, и день, пропущенный
   * потому, что у тебя в нём ничего не случилось, спрятал бы чужую новость за то, что ты в этот
   * день не взял уровень.
   *
   * Без `useMemo` нарочно: считать тут нечего — неделя своих дней и горстка чужих строк, — а
   * `buildFeed` выше уже посчитан и сюда приезжает готовым.
   */
  const dates = [...new Set([...mine.map((day) => day.date), ...social.events.map((e) => e.date)])]
    .filter((date) => date >= since)
    .sort((a, b) => (a < b ? 1 : -1))

  function heartsFor(ownerId: string, eventId: string): { people: string[]; mine: boolean } {
    const people = heartsOn(social, ownerId, eventId)
    return {
      people: people.map((id) => names.get(id) ?? '?'),
      mine: userId !== null && people.includes(userId),
    }
  }

  function toggle(ownerId: string, eventId: string, said: boolean) {
    void (said ? unheart(ownerId, eventId, since) : heart(ownerId, eventId, since))
  }

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <h1 className="sk-heading text-[32px] text-text-primary">Лента</h1>

        {dates.length === 0 ? (
          <p className="text-[13px] text-text-muted">
            За неделю пока ничего не случилось — ни у тебя, ни у друзей. Здесь встанут уровни,
            новые привычки и метки дороги.
          </p>
        ) : (
          dates.map((date) => {
            const day = mine.find((one) => one.date === date)
            const loud = day?.entries.filter((entry) => entry.loud) ?? []
            const quiet = day?.entries.filter((entry) => !entry.loud) ?? []
            const theirs = social.events.filter((event) => event.date === date)

            return (
              <section key={date} className="flex flex-col gap-2">
                <h2 className="sk-eyebrow">{dayTitle(date, today)}</h2>

                {/* Порядок внутри дня: сначала своё громкое, потом чужое, потом свои тихие
                    строки. День твой, и гость в нём стоит после хозяина; тихие строки — служебные
                    пометки собственной истории, и место им последнее. */}
                {/* Сердце прижато к своей карточке и отодвинуто от следующей. Равные отступы
                    сверху и снизу оставляли его висеть ровно между двумя событиями, и чьё оно —
                    приходилось угадывать: под новостью или над следующей. */}
                {loud.map((entry, i) => {
                  const id = feedEventId(date, entry.event)
                  const said = id === null || userId === null ? null : heartsFor(userId, id)
                  return (
                    <div key={`mine-${entry.event.kind}-${i}`} className="flex flex-col gap-1 pb-1.5">
                      <LoudCard entry={entry} onOpen={() => navigate(`/?day=${date}`)} />
                      {said !== null && id !== null && (
                        <Hearts
                          people={said.people}
                          mine={said.mine}
                          onToggle={() => toggle(userId as string, id, said.mine)}
                        />
                      )}
                    </div>
                  )
                })}

                {theirs.map((event) => {
                  const said = heartsFor(event.person.id, event.id)
                  return (
                    <div key={`theirs-${event.person.id}-${event.id}`} className="flex flex-col gap-1 pb-1.5">
                      <FriendCard event={event} />
                      <Hearts
                        people={said.people}
                        mine={said.mine}
                        onToggle={() => toggle(event.person.id, event.id, said.mine)}
                      />
                    </div>
                  )
                })}

                {quiet.map((entry, i) => (
                  <QuietLine key={`quiet-${entry.event.kind}-${i}`} entry={entry} />
                ))}
              </section>
            )
          })
        )}
      </div>
    </AppShell>
  )
}
