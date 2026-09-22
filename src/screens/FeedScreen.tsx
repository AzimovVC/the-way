import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Avatar from '../components/Avatar'
import ComebackHero from '../components/ComebackHero'
import Icon, { type IconName } from '../components/Icon'
import RankBadge from '../components/RankBadge'
import { comebackRank } from '../domain/comeback'
import {
  buildFeed,
  feedAge,
  feedEventId,
  hiddenFeedIds,
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

/**
 * The glyph of a calendar mark, and it repeats the road rather than inventing a second alphabet:
 * a trophy for what happens once, a plain sign for what comes round again.
 */
const CALENDAR_ICON: Record<keyof typeof CALENDAR_TITLE, IconName> = {
  start: 'flag',
  month: 'calendar',
  halfYear: 'trophy',
  year: 'trophy',
}

/** The size of the mark standing at the right of a row — one number, so no two rows differ by it. */
const MARK_SIZE = 60

/**
 * A round disc with a glyph — the slot a habit event fills with its medal.
 *
 * `count` rides the sign the same way the day count rides the rank medal, and here it earns its
 * place twice over: the names of several habits will not fit one line on a phone, and the number
 * is what keeps the cut line honest — it says how many there were even when the text stops at two.
 * One habit prints nothing: «1» beside a row that names it is the same thing said twice.
 */
function EventDisc({ icon, color, count }: { icon: IconName; color: string; count?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: MARK_SIZE, height: MARK_SIZE }}>
      <div
        className="grid h-full w-full place-items-center rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        <Icon name={icon} size={Math.round(MARK_SIZE * 0.5)} color="var(--ink-950)" />
      </div>
      {count !== undefined && count > 1 && (
        <span
          className="sk-num absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[11px] font-bold"
          style={{ backgroundColor: 'var(--cobalt-700)', color: 'var(--ink-950)' }}
        >
          {count}
        </span>
      )}
    </div>
  )
}

/**
 * Одна строка про новые привычки дня.
 *
 * Имена стоят в строке, а не прячутся за число: сердце говорят не замаху, а человеку, и «Пробежка»
 * — то, на что отвечают, тогда как «3» — то, что пролистывают. Число при этом сказано **один раз**,
 * на знаке: «„Пробежка" и ещё 2» рядом со знаком «3» — это одно число дважды.
 *
 * «Общая» стоит только у привычки, заведённой с другом, и имени друга рядом нет: с кем именно —
 * это про двоих, а лента приходит ко всем друзьям сразу.
 */
function goalHeadline(titles: string[], paired: boolean): string {
  const named = titles.map((title) => `«${title}»`).join(', ')
  if (paired) return `Новая общая привычка — ${named}`
  return titles.length > 1 ? `Новые привычки — ${named}` : `Новая привычка — ${named}`
}

/**
 * The skeleton every event in the feed is built on: who on the left, what on the right, the news
 * across the width below them.
 *
 * Yours and a friend's are the **same shape**, and that is the point. The row used to put a medal
 * where a friend's row puts a face, so the two halves of one feed had two silhouettes and the eye
 * had to parse before it could read. Now the person is always the person and the mark is always
 * the mark, and what tells the halves apart is the name — which is what the news is about anyway.
 */
function EventRow({
  who,
  meta,
  headline,
  mark,
  hero,
  chevron = false,
  clamp = false,
  handle,
}: {
  who: string
  meta: string
  headline: string
  mark: React.ReactNode
  hero?: React.ReactNode
  /**
   * Ник человека, чьё это событие. Есть только у чужой строки: кружок с именем открывают его
   * профиль — тот же жест, что в списке друзей (`PersonRow`), и тот же адрес.
   *
   * Своя строка его не носит: она вся целиком кнопка, открывающая день, а кнопка внутри кнопки
   * — это разметка, которой браузер не верит.
   */
  handle?: string
  /** There is a day behind this row and a tap opens it. See LoudCard. */
  chevron?: boolean
  /**
   * Заголовок из списка — в две строки, и дальше он обрывается.
   *
   * Обрывается честно: сколько их было, сказано на знаке, и строка, кончившаяся на третьем имени,
   * ничего не скрыла — она только не дочитана. Без предела день, в который человек разложил
   * по полкам восемь дел, занял бы экран одной новостью.
   */
  clamp?: boolean
}) {
  const navigate = useNavigate()

  const person = (
    <>
      <Avatar name={who} size={44} />
      <div className="flex min-w-0 flex-1 flex-col pt-0.5">
        <span className="truncate text-[15px] font-bold text-text-primary">{who}</span>
        <span className="text-[13px] text-text-muted">{meta}</span>
      </div>
    </>
  )

  return (
    <>
      <div className="flex w-full items-start gap-3">
        {handle === undefined ? (
          person
        ) : (
          <button
            type="button"
            onClick={() => navigate(`/u/${handle}`)}
            className="sk-focus flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            {person}
          </button>
        )}
        {mark}
      </div>
      {/* The news gets the full width and the display face. It is the one line a person reads at
          speed while scrolling, and a headline squeezed into the column beside a 60px mark loses
          about a third of its letters to it. */}
      <p
        className={`sk-heading text-left text-[19px] leading-snug text-text-primary${clamp ? ' line-clamp-2' : ''}`}
      >
        {headline}
        {chevron && (
          <Icon
            name="chevron-right"
            size={18}
            color="var(--color-text-muted)"
            className="ml-1.5 inline-block align-[-2px]"
          />
        )}
      </p>
      {hero}
    </>
  )
}

/**
 * Сердце и лица тех, кто его сказал.
 *
 * **Число и лица стоят вместе.** Числа сначала не было нарочно: своему событию сердце поставить
 * **можно**, то есть счёт накручиваем, — и лица снимали эту цену, потому что своё лицо среди двух
 * чужих никого не обманывает, а «3» обманывает. Число вернулось, но цена снята тем же самым: лица
 * остались под ним, и накрученная тройка немедленно называет себя по именам. Число отвечает
 * «сколько» с расстояния, лица — «кто», и это разные вопросы. Голое число без лиц сюда не
 * возвращается.
 *
 * The button is a bordered tile rather than a bare glyph: it is the only thing on the row a finger
 * is invited to press, and a 20px heart standing loose in a column of text does not look pressable
 * at all. Said, it goes coral inside a cobalt frame — the same pair the app uses everywhere for
 * «this one is chosen».
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
  // Three faces and then a number: past three the row stops being faces and becomes a crowd, and a
  // crowd is what the count was rejected for. The names say the rest.
  const shown = people.slice(0, 3)
  const rest = people.length - shown.length

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={mine ? 'Забрать сердце' : 'Сказать сердце'}
        aria-pressed={mine}
        className="sk-press sk-focus flex h-11 w-fit shrink-0 items-center gap-1.5 self-start rounded-[16px] border-2 px-3.5"
        style={{ borderColor: mine ? 'var(--cobalt-500)' : 'var(--color-border)' }}
      >
        <Icon
          name={mine ? 'heart-filled' : 'heart'}
          size={22}
          color={mine ? 'var(--color-day-red)' : 'var(--color-text-muted)'}
        />
        {/* Ноль не рисуется: «0» — это не новость о том, что никто не сказал, а лишняя цифра на
            кнопке, которую зовут нажать первой. */}
        {people.length > 0 && (
          <span className="text-[15px] font-bold tabular-nums text-text-secondary">{people.length}</span>
        )}
      </button>

      {/* Лица стоят внахлёст, как везде, где их несколько: ряд из пяти отдельных кружков читается
          как список людей, а это одна мысль — «вот кто». */}
      {people.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center">
            {shown.map((name, i) => (
              <Avatar
                key={`${name}-${i}`}
                name={name}
                size={24}
                ring
                className={i === 0 ? '' : '-ml-2'}
              />
            ))}
          </div>
          <span className="truncate text-[13px] text-text-muted">
            Сердце:{' '}
            <span className="font-bold text-text-secondary">
              {shown.join(', ')}
              {rest > 0 ? ` и ещё ${rest}` : ''}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * One loud event of your own.
 *
 * It is a button because there is a day behind it, and the chevron says so. Without it the row is
 * the same silhouette as a friend's row, which answers no finger at all — and a thing that takes a
 * tap but looks like it does not is a thing nobody taps.
 */
function LoudCard({
  entry,
  who,
  age,
  onOpen,
}: {
  entry: FeedEntry
  who: string
  age: string
  onOpen: () => void
}) {
  const { event } = entry

  let mark = <EventDisc icon="flag" color="var(--color-brand)" />
  let headline = ''
  let hero: React.ReactNode = null

  if (event.kind === 'calendar') {
    mark = <EventDisc icon={CALENDAR_ICON[event.mark]} color="var(--color-brand)" />
    headline = CALENDAR_TITLE[event.mark]
  } else if (event.kind === 'goal') {
    mark = <EventDisc icon={event.paired === true ? 'users' : 'flag'} color="var(--cobalt-500)" count={event.titles.length} />
    headline = goalHeadline(event.titles, event.paired === true)
  } else if (event.kind === 'rank') {
    // The day count rides the medal rather than a line of prose under the name: it is the number
    // the news is about, and a number printed on the thing it belongs to is read at a glance.
    mark = (
      <RankBadge
        rank={event.rank}
        size={MARK_SIZE}
        days={event.days}
        letter={event.title.trim().slice(0, 1).toUpperCase()}
      />
    )
    headline = `${rankLabel({ id: event.rank, days: event.days, year: Math.max(1, Math.floor(event.days / 365)) })} — «${event.title}»`
  } else if (event.kind === 'comeback') {
    mark = <EventDisc icon="trending-up" color="var(--color-day-green)" />
    // The rank word is the headline when there is one; the plain word stands in on the returns
    // between ranks. Neither says who came back: the app does not know, and the row is about the
    // road anyway.
    headline = comebackRank(event.comeback.ordinal) ?? 'Возвращение'
    // The stretch of road itself, and nothing in words beside it: «спад 5 дней, вверх 3» says the
    // same thing and shows nothing, while the shape is what the person recognises — they have been
    // looking at it all week.
    hero = <ComebackHero shape={event.comeback.shape} size="inline" track="var(--color-surface-sunken)" />
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="sk-press sk-focus flex w-full flex-col gap-2.5 rounded-[20px] text-left"
    >
      <EventRow who={who} meta={age} headline={headline} mark={mark} hero={hero} chevron clamp={event.kind === 'goal'} />
    </button>
  )
}

/**
 * Событие друга.
 *
 * Сама карточка не нажимается: за ней нет дня, который можно открыть. Чужая дорога не читается
 * никем, включая друзей, и стрелка «дальше» обещала бы экран, которого нет.
 *
 * Нажимается **человек**: кружок с именем ведут на его профиль — экран, который есть и который
 * из ленты ищут чаще всего. Это тот же жест, что в списке друзей, и ведёт он по тому же адресу.
 */
function FriendCard({ event, age }: { event: FriendEvent; age: string }) {
  const who = event.person.name.trim() === '' ? `@${event.person.handle}` : event.person.name

  let mark = <EventDisc icon="flag" color="var(--color-brand)" />
  let headline = ''

  if (event.kind === 'rank') {
    const days = event.days ?? 0
    mark = (
      <RankBadge
        rank={event.rank ?? 'novice'}
        size={MARK_SIZE}
        days={days}
        letter={(event.title ?? '').trim().slice(0, 1).toUpperCase()}
      />
    )
    headline = `${rankLabel({ id: event.rank ?? 'novice', days, year: Math.max(1, Math.floor(days / 365)) })} — «${event.title}»`
  } else if (event.kind === 'goal') {
    // Приехавший список имён — правда о числе: тихие привычки в него не попали (`spoken`), и
    // считать их по своей стороне здесь нечем и не нужно.
    const titles = event.titles ?? (event.title === undefined ? [] : [event.title])
    mark = <EventDisc icon="flag" color="var(--cobalt-500)" count={titles.length} />
    headline = goalHeadline(titles, false)
  } else {
    const at = event.mark ?? 'start'
    mark = <EventDisc icon={CALENDAR_ICON[at]} color="var(--color-brand)" />
    headline = CALENDAR_TITLE[at]
  }

  // Подпись про человека — **без глагола**: имя стоит своей строкой над новостью, а не внутри
  // фразы «Лена взяла Ученика». Глагол в русском выдаёт род, а его человек здесь нигде не называл.
  return (
    <div className="flex w-full flex-col gap-2.5">
      <EventRow
        who={who}
        meta={age}
        headline={headline}
        mark={mark}
        clamp={event.kind === 'goal'}
        handle={event.person.handle}
      />
    </div>
  )
}

/**
 * A quiet event: one line, no row of its own. Yours only — friends' feeds carry no service notes.
 *
 * It carries its own age too, because nothing else on the screen does any more: the day headings
 * are gone, and a line saying «заморозка удержала день» with no day in it is a note about nothing.
 */
function QuietLine({ entry, age }: { entry: FeedEntry; age: string }) {
  const { event } = entry

  let icon: IconName = 'moon'
  let color = 'var(--color-freeze)'
  let what = 'Заморозка удержала день'

  if (event.kind === 'taskChange') {
    const { change } = event
    icon = change.kind === 'added' ? 'plus' : change.kind === 'removed' ? 'minus' : 'calendar'
    color = change.kind === 'added' ? 'var(--cobalt-500)' : 'var(--color-text-muted)'
    what =
      (change.kind === 'added'
        ? 'Добавил привычку'
        : change.kind === 'removed'
          ? 'Убрал привычку'
          : 'Поменял расписание') + ` — «${change.title}»`
  } else if (event.kind !== 'freeze') {
    return null
  }

  return (
    <p className="flex items-center gap-2 text-[13px] text-text-muted">
      <Icon name={icon} size={14} color={color} />
      <span className="min-w-0 truncate">{what}</span>
      <span className="shrink-0 text-text-muted opacity-70">· {age.toLowerCase()}</span>
    </p>
  )
}

/**
 * One entry of the feed, with the hairline that ends it.
 *
 * The rule under the row replaces the card the row used to sit in. Cards were fighting the feed
 * twice over: a bordered box around every event made a column of boxes, in which nothing is louder
 * than anything else, and the heart had to stand outside the box it belonged to — floating exactly
 * halfway between two events, so whose it was had to be guessed. A rule separates and costs
 * nothing, and everything above it is one event, heart included.
 */
function FeedItem({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 border-b border-border pb-5">{children}</div>
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

  // Часы читаются **один раз** на весь список, и сегодняшний день берётся из того же чтения: два
  // события одной секунды, посчитанные порознь, разошлись бы на границе минуты и сказали бы разное
  // про одно и то же время.
  const now = new Date()
  const today = getLogicalToday(now)
  const nowMs = now.getTime()
  const since = feedSince(today)
  // Дорога читается целиком, а окно накладывается снаружи: `buildFeed` — единственное дорогое
  // место на экране, и вешать на него ещё и сегодняшнюю дату значило бы пересчитывать всю историю
  // при каждом переходе через 3:00.
  const road: FeedDay[] = useMemo(() => buildFeed(state), [state])
  // Тихие привычки. Своя строка про них на этом экране стоит — это своя лента, — но сердца под
  // ней нет: сказать его некому, а кнопка над событием, которого никому не показали, была бы
  // аплодисментами в пустом зале. Правило одно и то же, и живёт оно в `feedEventId`.
  const hidden = useMemo(() => hiddenFeedIds(state), [state])
  const mine: FeedDay[] = feedSinceDays(road, since)

  /** Своё имя на своих же событиях: лента теперь называет автора у каждого, и у твоих он ты. */
  const me = state.user.name.trim() || 'Ты'

  /**
   * Имя к ключу человека. Сердце приезжает ключом, а рисуется лицом, и взять имя больше неоткуда:
   * друзья уже лежат в контексте, а своё имя — в собственном профиле. Чужого имени, которого нет
   * в друзьях, здесь не бывает: сердце видно только тому, кому видно событие.
   */
  const names = useMemo(() => {
    const map = new Map<string, string>()
    for (const person of view.friends) map.set(person.id, person.name.trim() || `@${person.handle}`)
    if (userId !== null) map.set(userId, me)
    return map
  }, [view.friends, userId, me])

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
      <div className="flex flex-col gap-5 px-4 py-6">
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
              // Заголовка дня у группы нет: возраст теперь стоит у каждой строки, а «СЕГОДНЯ» над
              // четырьмя строками, каждая из которых говорит «Сегодня», — это одно и то же слово
              // пять раз. Сама группа осталась: порядок внутри дня — правило, а не оформление.
              <div key={date} className="flex flex-col gap-5">
                {/* Порядок внутри дня: сначала своё громкое, потом чужое, потом свои тихие
                    строки. День твой, и гость в нём стоит после хозяина; тихие строки — служебные
                    пометки собственной истории, и место им последнее. */}
                {loud.map((entry, i) => {
                  const id = feedEventId(date, entry.event, hidden)
                  const said = id === null || userId === null ? null : heartsFor(userId, id)
                  return (
                    <FeedItem key={`mine-${entry.event.kind}-${i}`}>
                      <LoudCard
                        entry={entry}
                        who={me}
                        age={feedAge(date, today, entry.at, nowMs)}
                        onOpen={() => navigate(`/?day=${date}`)}
                      />
                      {said !== null && id !== null && (
                        <Hearts
                          people={said.people}
                          mine={said.mine}
                          onToggle={() => toggle(userId as string, id, said.mine)}
                        />
                      )}
                    </FeedItem>
                  )
                })}

                {theirs.map((event) => {
                  const said = heartsFor(event.person.id, event.id)
                  return (
                    <FeedItem key={`theirs-${event.person.id}-${event.id}`}>
                      <FriendCard event={event} age={feedAge(date, today, event.at, nowMs)} />
                      <Hearts
                        people={said.people}
                        mine={said.mine}
                        onToggle={() => toggle(event.person.id, event.id, said.mine)}
                      />
                    </FeedItem>
                  )
                })}

                {quiet.map((entry, i) => (
                  <QuietLine key={`quiet-${entry.event.kind}-${i}`} entry={entry} age={feedAge(date, today, entry.at, nowMs)} />
                ))}
              </div>
            )
          })
        )}
      </div>
    </AppShell>
  )
}
