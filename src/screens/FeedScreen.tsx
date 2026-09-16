import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import ComebackHero from '../components/ComebackHero'
import Icon, { type IconName } from '../components/Icon'
import RankBadge from '../components/RankBadge'
import { comebackRank } from '../domain/comeback'
import { dayWord, daysBetween, formatLongDate } from '../domain/calendar'
import { buildFeed, countEntries, takeEntries, type FeedDay, type FeedEntry } from '../domain/feed'
import { getLogicalToday } from '../domain/pathEngine'
import { rankLabel } from '../domain/ranks'
import { useAppState } from '../state/appState'

/** How many entries the first page holds. Half a year of one habit is about thirty. */
const FIRST_PAGE = 40
const PAGE = 40

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
 * One loud event, as a card.
 *
 * The shape is Duolingo's feed row — a round mark on the left, a line of news, a quiet second line
 * — and that is all that transfers. There is no backend and nobody else here, so the avatar is the
 * habit's own medal, and there are no likes, no comments and no «Liked by»: a reaction button on
 * your own history would be the app applauding itself.
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
    // The rank word is the headline when there is one: «Ты вернулся. Вернулся» — which is what
    // joining the two gives on the first comeback — says the same word twice in four.
    title = comebackRank(event.comeback.ordinal) ?? 'Ты вернулся'
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

/** A quiet event: one line, no card. */
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
 * The road, read backwards.
 *
 * Everything on this screen is derived in [feed.ts](../domain/feed.ts) from the days the app holds
 * in memory — where the geometry has been applied, which is the only place a comeback can be read
 * from. Nothing here is stored, so restoring a backup rebuilds the whole feed rather than arriving
 * with somebody else's blanks.
 *
 * There is no empty state: the start of the path is always the oldest entry, so on the very first
 * day the screen has one card and a line about what comes next.
 */
export default function FeedScreen() {
  const { state } = useAppState()
  const navigate = useNavigate()
  const today = getLogicalToday(new Date())
  const feed = useMemo(() => buildFeed(state), [state])
  const [limit, setLimit] = useState(FIRST_PAGE)

  const shown: FeedDay[] = takeEntries(feed, limit)
  const hasMore = countEntries(shown) < countEntries(feed)

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <h1 className="sk-heading text-[32px] text-text-primary">Лента</h1>

        {feed.length === 0 ? (
          <p className="text-[13px] text-text-muted">
            Здесь появится всё, что случилось на дороге. Первая запись — сам старт.
          </p>
        ) : (
          <>
            {shown.map((day) => (
              <section key={day.date} className="flex flex-col gap-2">
                <h2 className="sk-eyebrow">{dayTitle(day.date, today)}</h2>
                {day.entries.map((entry, i) =>
                  entry.loud ? (
                    <LoudCard
                      key={`${entry.event.kind}-${i}`}
                      entry={entry}
                      onOpen={() => navigate(`/?day=${day.date}`)}
                    />
                  ) : (
                    <QuietLine key={`${entry.event.kind}-${i}`} entry={entry} />
                  ),
                )}
              </section>
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={() => setLimit((current) => current + PAGE)}
                className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus"
              >
                Раньше
              </button>
            )}

            {feed.length === 1 && (
              <p className="text-[13px] text-text-muted">
                Дальше здесь встанут уровни, пройденные цели и возвращения. Первый — на седьмой день.
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
