import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import DayCard from '../components/DayCard'
import Icon, { type IconName } from '../components/Icon'
import MetricInfo from '../components/MetricInfo'
import MonthGrid from '../components/MonthGrid'
import type { PopoverAnchor } from '../components/NodePopover'
import PeriodSummaryCard from '../components/PeriodSummaryCard'
import { spendFreezeOnDay } from '../domain/freezes'
import { reorderTasks } from '../domain/taskOrder'
import PathComparisonView, { type PathComparisonSegment } from '../components/PathComparisonView'
import TimeOfDayCard from '../components/TimeOfDayCard'
import WrappedCard, { type WrappedData } from '../components/WrappedCard'
import {
  computeGoalStats,
  computeStreak,
  computeWeekdayStats,
  detectPatterns,
  findBestRebounds,
  findSlumpRecoveryCycles,
  summarizePeriod,
} from '../domain/analytics'
import { formatMonthTitle, formatShortDate } from '../domain/calendar'
import type { Day, TaskTemplate } from '../domain/models'
import { WEEKDAY_FULL, WEEKDAY_LABELS } from '../domain/schedule'
import { useAppState } from '../state/appState'

type PeriodKey = 'month' | 'quarter' | 'year' | 'all'

const PERIOD_LABEL: Record<PeriodKey, string> = {
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
  all: 'Всё время',
}

const PERIOD_SPAN_DAYS: Record<PeriodKey, number | null> = {
  month: 30,
  quarter: 90,
  year: 365,
  all: null,
}

/** State is carried by a glyph and a colour; the system never uses emoji. */
const TREND_GLYPH: Record<'improving' | 'declining' | 'stable', { icon: IconName; color: string; label: string }> = {
  improving: { icon: 'trending-up', color: 'var(--color-day-green)', label: 'идёт лучше' },
  declining: { icon: 'trending-down', color: 'var(--color-day-red)', label: 'идёт слабее' },
  stable: { icon: 'minus', color: 'var(--color-text-muted)', label: 'как обычно' },
}

const COMPARISON_COLORS = ['var(--color-ring-start)', 'var(--color-day-green)']

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

function filterByPeriod(days: Day[], period: PeriodKey): Day[] {
  const span = PERIOD_SPAN_DAYS[period]
  const sorted = sortedByDate(days)
  return span === null ? sorted : sorted.slice(-span)
}

function groupByMonth(days: Day[]): Map<string, Day[]> {
  const map = new Map<string, Day[]>()
  for (const day of sortedByDate(days)) {
    const key = day.date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(day)
  }
  return map
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

/**
 * The statistics screen, read top to bottom as one argument: how the period went, which days
 * those were, what moved, and why. The blocks are deliberately unequal — the answer is at the
 * top and the archive is at the bottom, because a screen of seven equal cards makes the person
 * do the ranking themselves.
 *
 * The period chips scope everything down to «Почему». The two blocks below that read the whole
 * history on purpose and say so in their own subtitles: a habit's clock and the shape of its
 * slump-and-recovery cycles both need more days than a month holds.
 */
export default function StatsScreen() {
  const { state, setState, toggleDayTask } = useAppState()
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [openDayId, setOpenDayId] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const mapRef = useRef<HTMLElement>(null)
  // The card is laid out against the phone frame, not against the map — see NodePopover.
  const [frame, setFrame] = useState({ width: 390, height: 844 })

  useLayoutEffect(() => {
    const box = mapRef.current?.offsetParent
    if (!(box instanceof HTMLElement)) return
    const update = () => setFrame({ width: box.clientWidth, height: box.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  /**
   * A tap position from the calendar, moved into the frame's coordinates. Measured at tap time
   * rather than kept in state: this screen scrolls, so the grid's offset inside the frame is only
   * true for the frame in which the finger landed.
   */
  const anchorInFrame = (a: PopoverAnchor): PopoverAnchor => {
    const el = mapRef.current
    const box = el?.offsetParent
    if (!el || !(box instanceof HTMLElement)) return a
    const r = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    return { ...a, x: a.x + r.left - b.left, y: a.y + r.top - b.top }
  }
  const todayDayId = state.days[state.days.length - 1]?.id

  const periodDays = useMemo(() => filterByPeriod(state.days, period), [state.days, period])

  const taskTemplates = useMemo(() => {
    const map = new Map<string, TaskTemplate>()
    for (const goal of state.user.goals) for (const task of goal.tasks) map.set(task.id, task)
    return map
  }, [state.user.goals])

  // The whole road as the second argument: the streak on the card is «сейчас», not «за период».
  const summary = useMemo(() => summarizePeriod(periodDays, state.days), [periodDays, state.days])

  const wrapped = useMemo<WrappedData>(() => {
    const streak = computeStreak(periodDays)
    const cycles = findSlumpRecoveryCycles(periodDays)
    const longestDeclineLength = cycles.reduce((max, c) => Math.max(max, c.declineLength), 0)
    const { steepest } = findBestRebounds(periodDays)
    return {
      periodLabel: PERIOD_LABEL[period],
      streak,
      longestDeclineLength,
      bestRebound: steepest,
      patterns: detectPatterns(periodDays, state.user.goals),
    }
  }, [periodDays, period, state.user.goals])

  const weekdayStats = useMemo(() => computeWeekdayStats(periodDays), [periodDays])
  const goalStats = useMemo(() => computeGoalStats(state.user.goals, periodDays), [state.user.goals, periodDays])

  const cycleTrend = useMemo(() => {
    const cycles = findSlumpRecoveryCycles(state.days)
    if (cycles.length < 2) return null
    const mid = Math.floor(cycles.length / 2)
    const avg = (arr: typeof cycles) =>
      arr.reduce((sum, c) => sum + c.declineLength + c.recoveryLength, 0) / arr.length
    const early = avg(cycles.slice(0, mid))
    const late = avg(cycles.slice(mid))
    return { early, late, direction: late < early ? 'shorter' : late > early ? 'longer' : 'stable' } as const
  }, [state.days])

  /** Read over the whole history: the smoothest rebound is a rare shape, and a month rarely holds one. */
  const smoothestRebound = useMemo(() => findBestRebounds(state.days).smoothest, [state.days])

  const monthGroups = useMemo(() => groupByMonth(state.days), [state.days])
  const monthOptions = useMemo(() => [...monthGroups.keys()], [monthGroups])
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')

  const comparisonSegments: PathComparisonSegment[] = []
  if (compareA && monthGroups.has(compareA)) {
    comparisonSegments.push({ label: formatMonthTitle(compareA), color: COMPARISON_COLORS[0], days: monthGroups.get(compareA)! })
  }
  if (compareB && monthGroups.has(compareB)) {
    comparisonSegments.push({ label: formatMonthTitle(compareB), color: COMPARISON_COLORS[1], days: monthGroups.get(compareB)! })
  }

  const openDay = openDayId ? state.days.find((d) => d.id === openDayId) : undefined
  /** Named only when one weekday is genuinely ahead: with a tie, «крепче всего» picks a winner at random. */
  const bestWeekday = useMemo(() => {
    const seen = weekdayStats.filter((w) => w.sampleCount > 0)
    if (seen.length < 2) return null
    const sorted = [...seen].sort((a, b) => b.avgCompletionRate - a.avgCompletionRate)
    return sorted[0].avgCompletionRate > sorted[1].avgCompletionRate ? sorted[0] : null
  }, [weekdayStats])

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
      <h1 className="sk-heading text-[32px] text-text-primary">Статистика</h1>

      {/* One filter row above everything it scopes, so the same slice feeds every block below it. */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            data-selected={period === key}
            className="sk-chip sk-plinth sk-focus"
          >
            {PERIOD_LABEL[key]}
          </button>
        ))}
      </div>

      {summary ? (
        <PeriodSummaryCard
          summary={summary}
          periodLabel={PERIOD_LABEL[period]}
          info={
            <MetricInfo title="Золотые дни">
              <p>Золотой день — это когда ты закрыл все задачи дня. Не часть, а все.</p>
              <p>Считаются только те дни, когда были задачи. Выходные и заморозки не в счёт: они не портят результат и не улучшают.</p>
              <p>Стрелка сравнивает первую половину периода со второй. «Лучше» или «слабее» говорим с разницы в 10%.</p>
            </MetricInfo>
          }
        />
      ) : (
        <div className="sk-card">
          <p className="text-[15px] text-text-secondary">
            За этот период путь ещё ничего не спрашивал. Отметь первый день — и здесь появится счёт.
          </p>
        </div>
      )}

      {/* No heading of its own: the pager's month name is the heading, and two eyebrows in a row
          read as a nesting that isn't there. The «?» rides in the legend row instead. */}
      <section ref={mapRef}>
        <MonthGrid
          info={
            <MetricInfo title="Цвета дней">
              <p>Цвет тот же, что на дороге.</p>
              <p>Жёлтый — закрыл всё. Зелёный — часть. Красный — мимо. Фиолетовый — выходной.</p>
              <p>Клетка в рамке — этого дня ещё нет в истории.</p>
              <p>Месяцы листаются вбок. Нажми на день, чтобы посмотреть его.</p>
            </MetricInfo>
          }
          days={periodDays}
          todayDayId={todayDayId}
          onDaySelect={(day, a) => {
            setOpenDayId(day.id)
            setAnchor(anchorInFrame(a))
          }}
        />
      </section>

      {goalStats.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            {/* «за период» повторяет чипы периода, стоящие выше этого блока. */}
            <h2 className="sk-eyebrow">Привычки</h2>
            <MetricInfo title="Проценты у привычек">
              <p>Число справа — сколько ты закрыл за последние две недели.</p>
              <p>Стрелка сравнивает эти две недели со средним за период.</p>
              <p>Дни, когда привычку не спрашивали, не считаются. Иначе привычка на три раза в неделю всегда выглядела бы проваленной.</p>
            </MetricInfo>
          </div>
          <ul className="flex flex-col gap-3">
            {goalStats.map((g) => {
              const trend = TREND_GLYPH[g.trend]
              return (
                <li key={g.goalId} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] text-text-primary">{g.title}</span>
                    <span className="sk-num shrink-0 text-[15px] font-semibold text-text-primary">
                      {percent(g.recentAvg)}
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-surface-track"
                    style={{ boxShadow: 'var(--shadow-inset-well)' }}
                  >
                    <div
                      className="h-full rounded-full bg-day-green"
                      style={{ width: `${Math.max(2, g.recentAvg * 100)}%`, transition: 'width var(--dur-slow) var(--ease-out)' }}
                    />
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
                    <Icon name={trend.icon} size={14} color={trend.color} />
                    {trend.label}: за две недели {percent(g.recentAvg)}, в среднем {percent(g.overallAvg)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2">
          <h2 className="sk-eyebrow">По дням недели</h2>
          <MetricInfo title="Дни недели">
            <p>Столбик — сколько ты обычно закрываешь в такой день.</p>
            <p>Выходные и заморозки не считаются нулями. Отдых — это не провал.</p>
            <p>Прочерк значит, что в такие дни задач ещё не было.</p>
          </MetricInfo>
        </div>
        <p className="mb-3 text-[12px] text-text-muted">
          Выходные и заморозки не считаются.
          {bestWeekday && ` Лучше всего идёт ${WEEKDAY_FULL[bestWeekday.weekday].toLowerCase()}.`}
        </p>
        <div className="flex justify-between gap-1">
          {weekdayStats.map((w) => (
            <div key={w.weekday} className="flex flex-1 flex-col items-center gap-1">
              <span className="sk-num text-[11px] font-bold text-text-secondary">
                {w.sampleCount === 0 ? '—' : percent(w.avgCompletionRate)}
              </span>
              <div
                className="flex w-full items-end overflow-hidden rounded-[8px] bg-surface-track"
                style={{ height: 56, boxShadow: 'var(--shadow-inset-well)' }}
              >
                <div
                  className="w-full rounded-[8px] bg-day-green"
                  style={{
                    height: `${w.sampleCount === 0 ? 0 : Math.max(6, w.avgCompletionRate * 100)}%`,
                    transition: `height var(--dur-slow) var(--ease-out)`,
                  }}
                />
              </div>
              <span className="text-[11px] font-bold text-text-muted">{WEEKDAY_LABELS[w.weekday]}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        {/* Read over the whole history, not the selected period: a habit window needs every mark
            there is, and a month of a three-times-a-week task is twelve of them. */}
        <div className="flex items-center gap-2">
          <h2 className="sk-eyebrow">Время суток</h2>
          <MetricInfo title="Время суток">
            <p>Здесь видно, когда ты обычно берёшься за дело.</p>
            <p>Это только наблюдение. Дорога, цвет дня и уровни от времени не зависят. Сделал поздно — ничего не теряешь.</p>
            <p>День здесь заканчивается в 3 ночи. Отметка в 00:40 — это ещё вчера.</p>
          </MetricInfo>
        </div>
        <p className="mb-2 text-[12px] text-text-muted">За всё время, а не за период</p>
        <TimeOfDayCard days={state.days} goals={state.user.goals} />
      </section>

      <section className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setArchiveOpen((v) => !v)}
          aria-expanded={archiveOpen}
          className="sk-btn sk-btn-ghost sk-btn-block sk-focus"
        >
          {archiveOpen ? 'Свернуть' : 'Что было раньше'}
        </button>

        {archiveOpen && (
          <>
            <div>
              <h2 className="sk-eyebrow mb-2 block">Итоги периода</h2>
              <WrappedCard data={wrapped} />
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="sk-eyebrow">Сравнение месяцев</h2>
              <p className="text-[12px] text-text-muted">Выбери два месяца. Их дороги лягут рядом.</p>
              <div className="flex gap-2">
                <select value={compareA} onChange={(e) => setCompareA(e.target.value)} className="sk-input flex-1">
                  <option value="">Месяц A</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthTitle(m)}
                    </option>
                  ))}
                </select>
                <select value={compareB} onChange={(e) => setCompareB(e.target.value)} className="sk-input flex-1">
                  <option value="">Месяц B</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthTitle(m)}
                    </option>
                  ))}
                </select>
              </div>
              {comparisonSegments.length > 0 && <PathComparisonView segments={comparisonSegments} />}
            </div>

            {(cycleTrend || smoothestRebound) && (
              <div className="flex flex-col gap-1">
                <h2 className="sk-eyebrow mb-1">Срывы и возвращения</h2>
                {cycleTrend && (
                  <p className="text-[15px] text-text-secondary">
                    {cycleTrend.direction === 'shorter'
                      ? `После срыва ты возвращаешься быстрее: было ${Math.round(cycleTrend.early)} дн., стало ${Math.round(cycleTrend.late)}.`
                      : cycleTrend.direction === 'longer'
                        ? `Возвращаться после срыва стало дольше: было ${Math.round(cycleTrend.early)} дн., стало ${Math.round(cycleTrend.late)}.`
                        : `После срыва ты возвращаешься примерно за ${Math.round(cycleTrend.late)} дн.`}
                  </p>
                )}
                {smoothestRebound && (
                  <p className="text-[15px] text-text-secondary">
                    Самый плавный подъём — {smoothestRebound.length} дн., с {formatShortDate(smoothestRebound.startDate)} по{' '}
                    {formatShortDate(smoothestRebound.endDate)}.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {openDay && anchor && (
        <DayCard
          day={openDay}
          allDays={state.days}
          taskTemplates={taskTemplates}
          isToday={openDay.id === todayDayId}
          anchor={anchor}
          frameWidth={frame.width}
          frameHeight={frame.height}
          freezesRemaining={state.user.freezesRemaining}
          onClose={() => setOpenDayId(null)}
          onToggleTask={(dayTaskId) => toggleDayTask(openDay.id, dayTaskId)}
          onReorderTask={(ids) => setState(reorderTasks(state, ids))}
          onFreeze={() => setState(spendFreezeOnDay(state, openDay.id))}
        />
      )}
      </div>
    </AppShell>
  )
}
