import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import DayCard from '../../components/DayCard'
import FuturePopover from '../../components/FuturePopover'
import GifInbox from '../../components/GifInbox'
import GifPicker from '../../components/GifPicker'
import type { PopoverAnchor } from '../../components/NodePopover'
import Icon from '../../components/Icon'
import PathView, { type RoadFocus, type RoadHandle, type TodayNote } from '../../components/PathView'
import StreakSheet from '../../components/StreakSheet'
import WeekReviewScreen from '../../components/WeekReviewScreen'
import MonthReviewScreen from '../../components/MonthReviewScreen'
import { computeStreak } from '../../domain/analytics'
import { daysBetween } from '../../domain/calendar'
import { reviewWeek } from '../../domain/review'
import { reviewMonth } from '../../domain/monthReview'
import { addDaysISO } from '../../domain/pathEngine'
import { weekMarkElapsed, weekMarksThrough } from '../../domain/schedule'
import { upcomingMarkers } from '../../domain/horizon'
import { describeToday, planFor } from '../../domain/todayBrief'
import type { TaskTemplate } from '../../domain/models'
import { useAppState } from '../../state/appState'
import { useSocial } from '../../social/socialState'
import { circleOnDay, type CircleOnDay } from '../../social/circles'
import {
  useAvoidanceStrength,
  useFocusedDaysCount,
  useMaxTurnPerDay,
  useMaxWobble,
  useAvoidanceRadius,
  useCameraBackFraction,
  useGhostHorizonDays,
  useGreenThreshold,
  useTrendResponsePx,
  usePathZoomedOut,
  useFocusLiftFalloffDays,
  useFocusLiftPx,
  useScrollPxPerDay,
  useWeekBoxSizeRatio,
  useWobbleSensitivity,
  useZigzagAmplitude,
  useZigzagPeriod,
} from '../../dev/pathTuning'

/**
 * A metric reads as one unit: glyph and number share a pill and a colour, and
 * the numeral is tabular so the counter does not jitter as it ticks.
 *
 * With `onOpen` it is a button — the same pill, so the header does not grow a second shape for
 * the one metric that has a screen behind it.
 */
function MetricChip({
  icon,
  value,
  color,
  label,
  onOpen,
}: {
  icon: 'flame' | 'moon'
  value: number
  color: string
  label: string
  onOpen?: () => void
}) {
  const className = 'flex h-[34px] items-center gap-1.5 rounded-full bg-surface-raised px-3'
  const body = (
    <>
      <Icon name={icon} size={20} color={color} />
      <span className="sk-num text-[19px] font-semibold" style={{ color }}>
        {value}
      </span>
    </>
  )

  if (!onOpen) {
    return (
      <div className={className} aria-label={label}>
        {body}
      </div>
    )
  }
  return (
    <button type="button" onClick={onOpen} aria-label={label} className={`sk-press sk-focus ${className}`}>
      {body}
    </button>
  )
}

interface OpenDay {
  dayId: string
  /** Where the tapped circle stands inside the phone frame — the card opens on it. */
  anchor: PopoverAnchor
  /** Дорога, на которой стоит этот круг, — она умеет подвинуться под карточку и встать обратно. */
  road: RoadFocus
}

/**
 * Тот же самый случай, но для дня, который ещё не наступил: за ним нет `Day`, поэтому он назван
 * датой. Всё остальное — круг, якорь, дорога под карточкой — у него ровно то же.
 */
interface OpenFuture {
  date: string
  anchor: PopoverAnchor
  road: RoadFocus
}

export default function PathScreen() {
  const { state, dispatch, toggleDayTask, stepDayTask } = useAppState()
  // The path screen asks about people for two things: her tick in a shared habit, and the GIFs
  // friends sent. Neither goes into the road — the day card prints the tick, and the road is handed
  // a picture to draw beside today (TodayNote), not a fact to count.
  const { circles, mark, excuse, messages, sendGif, dismissMessages, view: friendsView } = useSocial()
  const [inboxOpen, setInboxOpen] = useState(false)
  const [picker, setPicker] = useState<{ recipientId?: string } | null>(null)
  const maxTurnPerDayDeg = useMaxTurnPerDay()
  const avoidanceRadiusPx = useAvoidanceRadius()
  const zigzagAmplitudePx = useZigzagAmplitude()
  const avoidanceStrengthDeg = useAvoidanceStrength()
  const zigzagPeriodDays = useZigzagPeriod()
  const wobbleSensitivity = useWobbleSensitivity()
  const maxWobblePx = useMaxWobble()
  const greenThreshold = useGreenThreshold()
  const trendResponsePx = useTrendResponsePx()
  const scrollPxPerDay = useScrollPxPerDay()
  const focusLiftPx = useFocusLiftPx()
  const focusLiftFalloffDays = useFocusLiftFalloffDays()
  const focusedDaysCount = useFocusedDaysCount()
  const weekBoxSizeRatio = useWeekBoxSizeRatio()
  const zoomedOut = usePathZoomedOut()
  const ghostDays = useGhostHorizonDays()
  const cameraBackFraction = useCameraBackFraction()

  // ?day=YYYY-MM-DD — where a trophy on the profile sends the road. Read as a plain date so the
  // link carries no state of its own: a day that is not in the history is simply ignored.
  const [searchParams] = useSearchParams()
  const focusDate = searchParams.get('day')

  const markersAhead = useMemo(() => upcomingMarkers(state), [state])
  // What the road cannot show yet. Listing it keeps a goal that is still months out from being
  // simply invisible — the horizon is a drawing limit, not a statement that nothing else exists.
  const todayDayId = state.days[state.days.length - 1]?.id
  const todayDate = state.days[state.days.length - 1]?.date ?? ''

  /**
   * Which weekly badge is open, by its number — the same Н the badge wears.
   *
   * The number rather than the date, because that is what the arrows walk along and what the
   * heading says back to the person: they tapped Н9 and the screen answers «Неделя 9». Everything
   * else about the week follows from it, so there is no second copy of the week to fall out of step
   * with the badge.
   */
  const [openWeekN, setOpenWeekN] = useState<number | null>(null)

  const firstDate = state.days[0]?.date ?? null
  const lastDate = state.days[state.days.length - 1]?.date ?? null
  /** The highest badge the road has laid; the archive never walks past it into weeks nobody lived. */
  const lastWeekN = firstDate && lastDate ? weekMarksThrough(firstDate, daysBetween(firstDate, lastDate)) : 0

  /**
   * The week badge Н`n` speaks for: the badge stands on the Monday that *opens* the next week, so
   * what it marks is the seven days behind it — the very week the summary would have arrived with
   * on that morning.
   */
  const weekStartOfBadge = (n: number) =>
    firstDate ? addDaysISO(addDaysISO(firstDate, weekMarkElapsed(firstDate, n)), -7) : null

  const openWeek = useMemo(() => {
    if (openWeekN === null) return null
    const start = weekStartOfBadge(openWeekN)
    // Floor of 0: the person tapped a badge they can see, so the week answers even when it counted
    // almost nothing. The screen drops its tiles rather than the road dropping the question.
    return start ? reviewWeek(state.days, start, { minCountedDays: 0 }) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWeekN, state.days, firstDate])

  /**
   * Which monthly badge is open, as its 'YYYY-MM'. The key rather than a number: a month names
   * itself on the road — «окт» — so the key is what the badge already said, and the arrows walk it
   * by stepping the calendar rather than by counting marks.
   */
  const [openMonthKey, setOpenMonthKey] = useState<string | null>(null)

  const monthKeys = useMemo(
    () => [...new Set(state.days.map((d) => d.date.slice(0, 7)))].sort(),
    [state.days],
  )
  const openMonth = useMemo(
    () => (openMonthKey ? reviewMonth(state.days, openMonthKey, state.days) : null),
    [openMonthKey, state.days],
  )
  const monthAt = (offset: number) => {
    const i = openMonthKey ? monthKeys.indexOf(openMonthKey) : -1
    return i === -1 ? null : (monthKeys[i + offset] ?? null)
  }

  const pathAreaRef = useRef<HTMLDivElement>(null)
  // Узел, а не ref: дорога рисует в него порталом, и ей нужно перерисоваться, когда он появился.
  const [dateSlot, setDateSlot] = useState<HTMLDivElement | null>(null)
  const [pathSize, setPathSize] = useState({ width: 390, height: 480 })
  // The phone frame's own box, and where the road's area starts inside it. PathView reports tap
  // positions in its own coordinates; the cards that open on them are laid out against the whole
  // frame, so they can hang past the road's edges rather than being trapped in it.
  const [frame, setFrame] = useState({ width: 390, height: 844, pathTop: 0 })

  useLayoutEffect(() => {
    const el = pathAreaRef.current
    if (!el) return
    const update = () => {
      setPathSize({ width: el.clientWidth, height: el.clientHeight })
      const box = el.offsetParent as HTMLElement | null
      setFrame({
        width: box?.clientWidth ?? el.clientWidth,
        height: box?.clientHeight ?? el.clientHeight,
        pathTop: el.offsetTop,
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.offsetParent instanceof HTMLElement) ro.observe(el.offsetParent)
    return () => ro.disconnect()
  }, [])

  const containerWidth = pathSize.width
  const containerHeight = pathSize.height

  /** A tap position from PathView, moved into the frame's coordinates. */
  const fromPath = (anchor: PopoverAnchor): PopoverAnchor => ({ ...anchor, y: anchor.y + frame.pathTop })

  const taskTemplates = useMemo(() => {
    const map = new Map<string, TaskTemplate>()
    for (const goal of state.user.goals) {
      for (const task of goal.tasks) map.set(task.id, task)
    }
    return map
  }, [state.user.goals])

  // Ручка дороги: плашка и ячейка с датой открывают день не сами, а её кругом (см. PathView).
  const roadRef = useRef<RoadHandle>(null)
  const [openDay, setOpenDay] = useState<OpenDay | null>(null)
  const [openFuture, setOpenFuture] = useState<OpenFuture | null>(null)
  const [streakOpen, setStreakOpen] = useState(false)

  const streak = useMemo(() => computeStreak(state.days), [state.days])
  const brief = useMemo(() => describeToday(state), [state])
  const futurePlan = useMemo(
    () => (openFuture ? planFor(state, openFuture.date) : null),
    [openFuture, state],
  )

  const openDayData = openDay ? state.days.find((d) => d.id === openDay.dayId) : undefined
  const cardIsToday = openDay?.dayId === todayDayId

  /**
   * Кружки открытой карточки, по привычке. Считается здесь, а не в карточке: её половина читается
   * из отметок, твоя — из дороги, и обе уже сложены парной серией.
   */
  const openDayCircles = useMemo(() => {
    const map = new Map<string, CircleOnDay>()
    if (openDayData === undefined) return map
    for (const circle of circles.circles) {
      // Закрытый кружок в дне не рисуется: пара кончилась, и вторая галочка рядом с твоей
      // обещала бы ответ, которого больше не будет. Сам кружок при этом лежит на месте — он
      // нужен прощальной карточке, и уносит его только она.
      if (circle.leftAt !== undefined) continue
      map.set(circle.taskId, circleOnDay(circle, state.days, openDayData.date, todayDate, state.user.timezone))
    }
    return map
  }, [circles, openDayData, state.days, todayDate, state.user.timezone])

  /**
   * The bubble by today's circle. It shows the oldest waiting GIF — the one the sheet opens on — and
   * is keyed by the newest, so every arrival pops it in again.
   */
  const todayNote = useMemo<TodayNote | null>(() => {
    const first = messages[0]
    const newest = messages[messages.length - 1]
    if (!first || !newest) return null
    const name = first.from.name.trim() || first.from.handle
    return {
      key: newest.id,
      image: first.gif.preview,
      width: first.gif.width,
      height: first.gif.height,
      initial: name.slice(0, 1).toUpperCase(),
      count: messages.length,
      label: `Гифка от ${name}`,
      onOpen: () => setInboxOpen(true),
    }
  }, [messages])

  return (
    <AppShell>
      <header className="flex min-h-14 shrink-0 items-center gap-2 px-3">
        <MetricChip
          icon="flame"
          value={streak.currentGoldStreak}
          color="var(--color-streak-flame)"
          label="Золотая серия"
          onOpen={() => setStreakOpen(true)}
        />
        <MetricChip
          icon="moon"
          value={state.user.freezesRemaining}
          color="var(--color-freeze)"
          label="Дни отдыха (заморозки)"
        />
        {/* Sending lives here, on the road, because this is where a GIF arrives: the button and the
            bubble answer each other on one screen. The same pill as the chips beside it, pushed to
            the far end — it is an action, and they are counts. */}
        <button
          type="button"
          onClick={() => setPicker({})}
          aria-label="Отправить гифку другу"
          className="sk-press sk-focus ml-auto flex h-[34px] items-center rounded-full px-3"
          style={{ backgroundColor: 'var(--violet-800)', color: 'var(--violet-400)' }}
        >
          <span className="sk-num text-[15px] font-bold tracking-wide">GIF</span>
        </button>
      </header>

      <div className="flex shrink-0 px-3 pb-2">
        {/* Always the goal's own colour — even mid-slump. The road below already says how things
            are going, and it draws the way back; a second, darker label naming what you are
            failing at would be the streak-guilt the voice rules out. The big line is the state of
            today rather than the goal's name, which the user knows by heart; the goal stays above
            it, so it is never the plate that disappears — see describeToday.

            Tapping it opens today's card, the same sheet today's circle opens. The circle scrolls
            away, the plate does not, and a second list of the same tasks would be a second place
            for one truth. Открывает она его **кругом**: дорога доезжает до сегодня и карточка
            растёт из круга (roadRef). Выезжая из самой плашки, карточка про сегодня появлялась
            иначе, чем та же карточка про тот же день, открытая на дороге, — и не показывала, где
            это сегодня стоит.

            Nothing sits beside it: creating a goal is a once-or-twice-ever act, it has a home on
            the Привычки tab, and a 52px button in the top corner is both the rarest action here and
            the hardest to reach with a thumb. */}
        <div
          className="flex min-w-0 flex-1 items-stretch rounded-[20px]"
          style={{
            backgroundColor: 'var(--color-day-green)',
            boxShadow: '0 4px 0 var(--teal-700)',
          }}
        >
          <button
            type="button"
            disabled={!todayDayId}
            onClick={() => todayDayId && roadRef.current?.openDay(todayDayId)}
            aria-label="Сегодняшний день"
            className="sk-press sk-focus flex min-w-0 flex-1 flex-col gap-0.5 rounded-[20px] px-4 py-3 text-left"
          >
            {/* Верхняя строка — два конца одного факта: слева глагол, справа число. Глагол и есть
                смысл: «1 из 3» в углу само по себе читается как «сделал одну из трёх», то есть
                наоборот, и читается так молча. Строка держится и пустой (min-h), чтобы плашка не
                прыгала в день, когда всё сделано. */}
            <span className="flex min-h-[14px] items-baseline gap-2">
              <span className="sk-eyebrow min-w-0 flex-1 truncate" style={{ color: 'rgba(0,0,0,.55)' }}>
                {brief.label}
              </span>
              <span className="sk-num shrink-0 text-[15px] font-bold" style={{ color: 'var(--ink-950)' }}>
                {brief.count}
              </span>
            </span>
            {/* Большая строка называет **что** осталось — единственное, чего число сказать не может.
                Это текст, и только текст: отмечают в карточке дня, и второго места для этого нет.
                Имена, не влезшие в строку, уходят в «+2» — оно стоит отдельным элементом, чтобы
                обрезалось имя, а не счёт хвоста. */}
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="sk-heading min-w-0 truncate text-2xl" style={{ color: 'var(--ink-950)' }}>
                {brief.headline}
              </span>
              {brief.more > 0 && (
                <span className="sk-num shrink-0 text-[15px] font-bold" style={{ color: 'rgba(0,0,0,.55)' }}>
                  +{brief.more}
                </span>
              )}
            </span>
          </button>
          {/* Черта и ячейка за ней — место для даты, которое дорога заполняет сама (dateSlot в
              PathView). Черта нужна затем, что справа стоит **другое подлежащее**: слева плашка
              говорит про сегодня, справа — какой день сейчас показывает дорога, и без границы это
              читалось бы одним предложением. Ячейка держится здесь и пустой — она часть плашки, а
              не всплывающая подсказка, и её ширина не должна появляться вместе с содержимым. */}
          <span className="w-0.5 shrink-0" style={{ background: 'rgba(0,0,0,.14)' }} />
          <div ref={setDateSlot} className="flex shrink-0 items-stretch" />
        </div>
      </div>

      <div
        ref={pathAreaRef}
        className="relative min-h-0 flex-1 transition-[filter] duration-300"
        style={{ filter: openDay || openFuture ? 'grayscale(1) brightness(0.55)' : 'none' }}
      >
        <PathView
          roadRef={roadRef}
          dateSlot={dateSlot}
          openDayId={openDay?.dayId ?? null}
          openFutureDate={openFuture?.date ?? null}
          days={state.days}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          todayDayId={todayDayId}
          maxTurnPerDayDeg={maxTurnPerDayDeg}
          avoidanceRadiusPx={avoidanceRadiusPx}
          zigzagAmplitudePx={zigzagAmplitudePx}
          avoidanceStrengthDeg={avoidanceStrengthDeg}
          zigzagPeriodDays={zigzagPeriodDays}
          wobbleSensitivity={wobbleSensitivity}
          maxWobblePx={maxWobblePx}
          greenThreshold={greenThreshold}
          trendResponsePx={trendResponsePx}
          scrollPxPerDay={scrollPxPerDay}
          focusLiftPx={focusLiftPx}
          focusLiftFalloffDays={focusLiftFalloffDays}
          focusedDaysCount={focusedDaysCount}
          weekBoxSizeRatio={weekBoxSizeRatio}
          zoomedOut={zoomedOut}
          ghostDays={ghostDays}
          cameraBackFraction={cameraBackFraction}
          markersAhead={markersAhead}
          focusDate={focusDate}
          showMascot
          onDaySelect={(day, anchor, road) =>
            setOpenDay({ dayId: day.id, anchor: fromPath(anchor), road })
          }
          onFutureTap={(date, anchor, road) => setOpenFuture({ date, anchor: fromPath(anchor), road })}
          onWeekSelect={(markDate) =>
            firstDate && setOpenWeekN(weekMarksThrough(firstDate, daysBetween(firstDate, markDate)))
          }
          onMonthSelect={(markDate) => setOpenMonthKey(markDate.slice(0, 7))}
          todayNote={todayNote}
        />
      </div>

      {openDay && openDayData && (
        <DayCard
          day={openDayData}
          taskTemplates={taskTemplates}
          isToday={cardIsToday}
          circles={openDayCircles}
          anchor={openDay.anchor}
          // Карточка не прокручивается — вместо этого дорога отдаёт ей место: круг поднимается
          // ровно на недостачу и встаёт обратно, когда карточку закрыли. Прокрутка внутри
          // карточки означала бы, что день частично спрятан в самом себе, а день тут и есть
          // единственное, о чём карточка говорит.
          requestRoom={(needed, done) =>
            openDay.road.raiseTo(frame.height - needed - frame.pathTop, (a) => {
              setOpenDay((prev) => (prev ? { ...prev, anchor: fromPath(a) } : prev))
              done()
            })
          }
          frameWidth={frame.width}
          frameHeight={frame.height}
          freezesRemaining={state.user.freezesRemaining}
          onClose={() => {
            openDay.road.release()
            setOpenDay(null)
          }}
          onToggleTask={(taskTemplateId) => {
            const row = openDayData.tasks.find((t) => t.taskTemplateId === taskTemplateId)
            // Твоя строка закрывается **сразу**: ожидание чужого ответа внутри собственной отметки
            // — это лаг там, где его быть не должно. Наружу отметка уходит следом и молча.
            toggleDayTask(openDay.dayId, taskTemplateId)
            const circle = circles.circles.find((c) => c.taskId === taskTemplateId && c.leftAt === undefined)
            if (circle !== undefined && cardIsToday && row !== undefined) {
              // Паре уезжает «я своё сделал», а не «день засчитан». У привычки, которую держат
              // только вместе, это разные вещи: твоя половина готова, и ждёт она ровно её ответа
              // — который никогда не придёт, если про твой ей не сказали.
              void mark(circle.id, openDayData.date, !(row.isDone || row.pending === true), new Date())
            }
          }}
          onStepTask={(taskTemplateId, delta) => {
            const row = openDayData.tasks.find((t) => t.taskTemplateId === taskTemplateId)
            const count = taskTemplates.get(taskTemplateId)?.target?.count ?? 0
            stepDayTask(openDay.dayId, taskTemplateId, delta)
            // Паре уезжает не «прибавил один», а закрылась ли строка: наружу отметка двоичная, и
            // счёт внутри дня — твоё дело, а не общее. Считается тем же правилом, что в домене.
            const circle = circles.circles.find((c) => c.taskId === taskTemplateId && c.leftAt === undefined)
            if (circle !== undefined && cardIsToday && row !== undefined && count > 0) {
              const filled = Math.max(0, Math.min(count, (row.progress ?? 0) + delta)) >= count
              const was = row.isDone || row.pending === true
              if (filled !== was) void mark(circle.id, openDayData.date, filled, new Date())
            }
          }}
          onFreeze={() => {
            dispatch({ kind: 'spendFreeze', dayId: openDay.dayId })
            // Заморозка — новость для пары: день, освободивший тебя, не должен читаться у неё как
            // пропуск. Уходит она только за сегодня, и это не наша осторожность, а правило сервера:
            // отметку принимают за сегодняшний день, иначе парный счёт накручивается из консоли.
            if (!cardIsToday) return
            for (const circle of circles.circles) {
              if (circle.leftAt !== undefined) continue
              if (openDayData.tasks.some((task) => task.taskTemplateId === circle.taskId)) {
                void excuse(circle.id, openDayData.date)
              }
            }
          }}
        />
      )}

      {openWeek && openWeekN !== null && (
        <WeekReviewScreen
          review={openWeek}
          variant="archive"
          steps={{
            n: openWeekN,
            onPrev: openWeekN > 1 ? () => setOpenWeekN(openWeekN - 1) : null,
            onNext: openWeekN < lastWeekN ? () => setOpenWeekN(openWeekN + 1) : null,
          }}
          onClose={() => setOpenWeekN(null)}
        />
      )}

      {openMonth && (
        <MonthReviewScreen
          review={openMonth}
          days={state.days}
          today={lastDate ?? undefined}
          steps={{
            onPrev: monthAt(-1) ? () => setOpenMonthKey(monthAt(-1)) : null,
            onNext: monthAt(1) ? () => setOpenMonthKey(monthAt(1)) : null,
          }}
          onClose={() => setOpenMonthKey(null)}
        />
      )}

      {streakOpen && (
        <StreakSheet days={state.days} todayDayId={todayDayId} onClose={() => setStreakOpen(false)} />
      )}

      {openFuture && futurePlan && (
        <FuturePopover
          plan={futurePlan}
          anchor={openFuture.anchor}
          frameWidth={frame.width}
          frameHeight={frame.height}
          // Место просят так же, как карточка дня: круг поднимается на недостачу и встаёт обратно.
          // Прокрутка внутри карточки прятала бы часть дня внутри самого дня.
          requestRoom={(needed, done) =>
            openFuture.road.raiseTo(frame.height - needed - frame.pathTop, (a) => {
              setOpenFuture((prev) => (prev ? { ...prev, anchor: fromPath(a) } : prev))
              done()
            })
          }
          onClose={() => {
            openFuture.road.release()
            setOpenFuture(null)
          }}
        />
      )}

      {inboxOpen && messages.length > 0 && (
        <GifInbox
          messages={messages}
          onClose={(seen) => {
            setInboxOpen(false)
            if (seen.length > 0) void dismissMessages(seen)
          }}
          onReply={(personId) => setPicker({ recipientId: personId })}
        />
      )}

      {picker && (
        <GifPicker
          friends={friendsView.friends}
          initialRecipientId={picker.recipientId}
          onSend={sendGif}
          onClose={() => setPicker(null)}
        />
      )}
    </AppShell>
  )
}
