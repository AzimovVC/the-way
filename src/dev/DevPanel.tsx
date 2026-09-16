import { useEffect, useState } from 'react'
import ComebackCelebration from '../components/ComebackCelebration'
import MilestoneCelebration from '../components/MilestoneCelebration'
import DayReviewScreen from '../components/DayReviewScreen'
import WeekReviewScreen from '../components/WeekReviewScreen'
import { removeLastDays, simulateFutureDays } from '../domain/dayLifecycle'
import { findComebacks, type Comeback } from '../domain/comeback'
import { buildCycleReport, computeMilestoneProgress } from '../domain/milestones'
import { lastCompleteWeekStart, reviewDay, reviewWeek, type DayReview, type WeekReview } from '../domain/review'
import {
  DAY_SPACING_PX,
  MAX_TURN_PER_DAY_CAP,
  MAX_WOBBLE_CAP,
  SMOOTHING_WINDOW_DAYS,
  ZIGZAG_AMPLITUDE_CAP,
} from '../domain/config'
import { clearState } from '../storage/appStorage'
import { buildTestHistory } from './seedHistory'
import { SAMPLE_COMEBACK, SAMPLE_DAY_REVIEW, SAMPLE_TIER_AWARD, SAMPLE_WEEK_REVIEW } from './sampleReviews'
import { useAppState, type CelebrationInfo } from '../state/appState'
import {
  setAvoidanceStrength,
  setFocusedDaysCount,
  setMaxTurnPerDay,
  setMaxWobble,
  setAvoidanceRadius,
  setCameraBackFraction,
  setGhostHorizonDays,
  setGreenThreshold,
  setTrendResponsePx,
  setPathZoomedOut,
  setScrollPxPerDay,
  setWeekBoxSizeRatio,
  setWobbleSensitivity,
  setZigzagAmplitude,
  setZigzagPeriod,
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
  useScrollPxPerDay,
  useWeekBoxSizeRatio,
  useWobbleSensitivity,
  useZigzagAmplitude,
  useZigzagPeriod,
} from './pathTuning'

const PRESETS: { label: string; rate: number | 'random' }[] = [
  { label: '100%', rate: 1 },
  { label: '80%', rate: 0.8 },
  { label: '50%', rate: 0.5 },
  { label: '20%', rate: 0.2 },
  { label: '0%', rate: 0 },
  { label: 'случайно', rate: 'random' },
]

/** Dev-only fast-forward tool: appends N future days at a chosen completion rate so the path's bend over weeks can be previewed without waiting in real time. Never rendered in production builds. */
export default function DevPanel() {
  const { state, setState } = useAppState()
  const [open, setOpen] = useState(false)
  // Which summary screen is being looked at. It is shown on top of everything, so the panel gets
  // out of the way: a preview half-covered by the panel that opened it is not a preview.
  const [preview, setPreview] = useState<'day' | 'week' | 'comeback' | 'milestone' | null>(null)
  const [days, setDays] = useState(7)
  const [rate, setRate] = useState<number | 'random'>(1)
  const [removeCount, setRemoveCount] = useState(7)
  const maxTurnPerDay = useMaxTurnPerDay()
  const avoidanceRadius = useAvoidanceRadius()
  const zigzagAmplitude = useZigzagAmplitude()
  const zigzagPeriod = useZigzagPeriod()
  const wobbleSensitivity = useWobbleSensitivity()
  const maxWobble = useMaxWobble()
  const avoidanceStrength = useAvoidanceStrength()
  const scrollPxPerDay = useScrollPxPerDay()
  const focusedDaysCount = useFocusedDaysCount()
  const weekBoxSizeRatio = useWeekBoxSizeRatio()
  const pathZoomedOut = usePathZoomedOut()
  const ghostHorizonDays = useGhostHorizonDays()
  const cameraBackFraction = useCameraBackFraction()
  const greenThreshold = useGreenThreshold()
  const trendResponsePx = useTrendResponsePx()

  // Read the two sliders back as the thing they actually decide, because neither number means
  // anything on its own. The rate is a trailing mean over SMOOTHING_WINDOW_DAYS days, so after k
  // misses in a row it is (window - k) / window; the first k that falls below the threshold is the
  // first miss the road reacts to at all. And the heading closes delta/trendResponsePx per px of
  // travel, so over one DAY_SPACING_PX step it shuts that fraction of the gap to the target.
  const firstVisibleMiss = Array.from({ length: SMOOTHING_WINDOW_DAYS }, (_, i) => i + 1).find(
    (k) => (SMOOTHING_WINDOW_DAYS - k) / SMOOTHING_WINDOW_DAYS < greenThreshold,
  )
  const gapClosedPerDay = Math.min(1, DAY_SPACING_PX / trendResponsePx)

  function runSimulation() {
    const completionRateFor = rate === 'random' ? () => Math.random() : () => rate
    setState(simulateFutureDays(state, days, completionRateFor))
  }

  const effectiveRemoveCount = Math.min(removeCount, Math.max(1, state.days.length))

  function runRemoval() {
    setState(removeLastDays(state, effectiveRemoveCount))
  }

  function seedTestHistory() {
    if (state.days.length > 0 && !confirm('Заменить текущий прогресс тестовой историей?')) return
    setState(buildTestHistory())
  }

  // The same seed, reachable from the browser console and from the run-the-way driver, so a
  // scripted check and a manual one start from exactly the same history.
  useEffect(() => {
    ;(window as unknown as { seedTestHistory?: () => void }).seedTestHistory = () =>
      setState(buildTestHistory())
  })

  function resetAll() {
    if (!confirm('Стереть весь прогресс и начать заново?')) return
    clearState()
    window.location.reload()
  }

  function showPreview(which: 'day' | 'week' | 'comeback' | 'milestone') {
    setPreview(which)
    setOpen(false)
  }

  /** The most recent day that earned a screen, or the sample when the history holds none. */
  function dayPreview(): DayReview {
    const id = [...state.days].reverse().find((d) => d.colorTier === 'gold')?.id
    return (id ? reviewDay(state.days, id) : null) ?? SAMPLE_DAY_REVIEW
  }

  /** The week that ended most recently, or the sample when it judged nothing. */
  function weekPreview(): WeekReview {
    const today = state.days[state.days.length - 1]?.date
    return (today ? reviewWeek(state.days, lastCompleteWeekStart(today)) : null) ?? SAMPLE_WEEK_REVIEW
  }

  /** The most recent comeback the road holds, or the sample when it has never fallen and returned. */
  function comebackPreview(): Comeback {
    return findComebacks(state.days).at(-1) ?? SAMPLE_COMEBACK
  }

  /**
   * The rank screen for the first live task, at the tier it is walking toward — or the sample when
   * there is no task at all. Nothing is awarded here: the panel opens the screen, it does not hand
   * out the rank, so what is on it is what the person would really see when the days run out.
   */
  function milestonePreview(): CelebrationInfo {
    for (const goal of state.user.goals) {
      if (goal.archived) continue
      const task = goal.tasks[0]
      if (!task) continue
      const progress = computeMilestoneProgress(task, state.days)
      // Whichever of the two screens the habit is closer to: the target while it is still ahead,
      // the next rung of the ladder once the person has passed their own finish.
      const event = progress.targetReached
        ? ({ kind: 'rank', rank: progress.nextRank } as const)
        : ({ kind: 'target', rank: progress.currentRank } as const)
      const report = buildCycleReport(task, progress, event)
      return {
        kind: report.kind,
        taskId: task.id,
        goalId: goal.id,
        goalTitle: goal.title,
        taskTitle: task.title,
        rank: report.rank,
        report,
      }
    }
    return SAMPLE_TIER_AWARD
  }

  const lastDate = state.days.reduce((max, d) => (d.date > max ? d.date : max), state.days[0]?.date ?? '—')

  return (
    <div className="fixed bottom-[84px] left-3 z-50 font-sans text-xs" style={{ colorScheme: 'dark' }}>
      {open ? (
        <>
          {/* Tapping anywhere outside the panel closes it — so checking how a slider changed
              the path doesn't require hunting for the tiny ✕ every time. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-50 w-64 max-h-[85vh] overflow-y-auto rounded-xl border-2 border-dashed border-amber-400 bg-black/90 p-3 text-white shadow-xl"
          >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold uppercase tracking-wide text-amber-400">Dev · перемотка времени</span>
            <button type="button" onClick={() => setOpen(false)} className="text-white/60">
              ✕
            </button>
          </div>

          <p className="mb-2 text-white/50">Последний день: {lastDate}</p>

          <button
            type="button"
            onClick={() => setPathZoomedOut(!pathZoomedOut)}
            className={`mb-3 w-full rounded px-2 py-1.5 font-semibold ${
              pathZoomedOut ? 'bg-amber-400 text-black' : 'bg-white/10 text-white'
            }`}
          >
            {pathZoomedOut ? 'Приблизить путь' : 'Отдалить путь'}
          </button>
          <p className="mb-3 text-white/40">
            Показать весь маршрут целиком, чтобы посмотреть геометрию. Только здесь — в самом приложении
            кнопки нет; пользовательский вид всего маршрута живёт на экране статистики.
          </p>

          <label className="mb-1 block text-white/70">Дней вперёд</label>
          <input
            type="number"
            min={1}
            max={120}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
            className="mb-2 w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-white"
          />

          <label className="mb-1 block text-white/70">Выполнение каждого дня</label>
          <div className="mb-3 grid grid-cols-3 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setRate(p.rate)}
                className={`rounded px-2 py-1 ${rate === p.rate ? 'bg-amber-400 text-black' : 'bg-white/10 text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={seedTestHistory}
            className="mb-1 w-full rounded bg-emerald-400 px-2 py-1.5 font-semibold text-black"
          >
            Тестовая история
          </button>
          <p className="mb-3 text-white/40">
            4 недели назад: две цели с разным расписанием (Пн/Ср/Пт и Пн–Пт), выходные по субботам и
            воскресеньям, спад на третьей неделе и восстановление. Сегодня оставлен неотмеченным.
          </p>

          {/* The two summary screens, opened on the spot — otherwise the day one waits for the last
              task of the day and the week one waits for a Monday. */}
          <div className="mb-1 flex gap-1">
            <button
              type="button"
              onClick={() => showPreview('day')}
              className="flex-1 rounded bg-white/10 px-2 py-1.5 font-semibold text-white"
            >
              Итог дня
            </button>
            <button
              type="button"
              onClick={() => showPreview('week')}
              className="flex-1 rounded bg-white/10 px-2 py-1.5 font-semibold text-white"
            >
              Итог недели
            </button>
            <button
              type="button"
              onClick={() => showPreview('comeback')}
              className="flex-1 rounded bg-white/10 px-2 py-1.5 font-semibold text-white"
            >
              Возвращение
            </button>
          </div>
          <button
            type="button"
            onClick={() => showPreview('milestone')}
            className="mb-1 w-full rounded bg-white/10 px-2 py-1.5 font-semibold text-white"
          >
            Уровень / финиш привычки
          </button>
          <p className="mb-3 text-white/40">
            Берётся из истории: последний золотой день и последняя закончившаяся неделя. Если их ещё
            нет — показывается образец, чтобы экран можно было посмотреть и на пустом состоянии.
            Экран уровня берёт первую живую задачу и тот уровень, к которому она идёт. Уровень при этом не
            выдаётся — но кнопка «Завершить привычку» на нём настоящая и правда закроет цель.
          </p>

          <button
            type="button"
            onClick={runSimulation}
            className="mb-2 w-full rounded bg-amber-400 px-2 py-1.5 font-semibold text-black"
          >
            Добавить {days} {days === 1 ? 'день' : 'дней'}
          </button>

          <label className="mb-1 block text-white/70">Убрать последних дней</label>
          <div className="mb-2 flex gap-1">
            <input
              type="number"
              min={1}
              max={Math.max(1, state.days.length)}
              value={effectiveRemoveCount}
              onChange={(e) => setRemoveCount(Math.max(1, Math.min(state.days.length, Number(e.target.value) || 1)))}
              className="w-16 rounded border border-white/20 bg-white/10 px-2 py-1 text-white"
            />
            <button
              type="button"
              onClick={runRemoval}
              disabled={state.days.length === 0}
              className="flex-1 rounded bg-white/10 px-2 py-1.5 font-semibold text-white disabled:opacity-40"
            >
              Убрать {effectiveRemoveCount} {effectiveRemoveCount === 1 ? 'день' : 'дней'}
            </button>
          </div>

          <button type="button" onClick={resetAll} className="mb-3 w-full rounded border border-white/20 px-2 py-1.5 text-white/70">
            Сбросить весь прогресс
          </button>

          <label className="mb-1 flex items-center justify-between text-white/70">
            <span>Скорость прокрутки</span>
            <span className="text-amber-400">{scrollPxPerDay}px/день</span>
          </label>
          <input
            type="range"
            min={20}
            max={300}
            step={10}
            value={scrollPxPerDay}
            onChange={(e) => setScrollPxPerDay(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Сколько физического скролла нужно, чтобы пройти один день. Больше — медленнее и подробнее.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Горизонт (дорога вперёд)</span>
            <span className="text-amber-400">{ghostHorizonDays} дн.</span>
          </label>
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={ghostHorizonDays}
            onChange={(e) => setGhostHorizonDays(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">
            Насколько далеко за сегодня рисуется дорога и докуда можно долистать вперёд. 14 — чтобы
            в окно всегда попадал недельный чип и целиком помещался разворот к цели (~8 дней).
          </p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Кадр: прошлое / будущее</span>
            <span className="text-amber-400">
              {Math.round(cameraBackFraction * 100)} / {Math.round((1 - cameraBackFraction) * 100)}
            </span>
          </label>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.05}
            value={cameraBackFraction}
            onChange={(e) => setCameraBackFraction(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">
            Какую долю кадра камера отдаёт дороге позади. Камера центрируется на середине этого окна,
            а не на сегодня, поэтому одно число работает и когда дорога растёт, и когда падает —
            сегодня само встаёт туда, где честно оказывается. Сейчас в покое видно{' '}
            <span className="text-amber-400">
              ~{(focusedDaysCount * cameraBackFraction).toFixed(1)} дн.
            </span>{' '}
            истории и{' '}
            <span className="text-amber-400">
              ~{(focusedDaysCount * (1 - cameraBackFraction)).toFixed(1)} дн.
            </span>{' '}
            дороги вперёд.
          </p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Порог «идём к цели»</span>
            <span className="text-amber-400">{greenThreshold.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0.3}
            max={0.9}
            step={0.05}
            value={greenThreshold}
            onChange={(e) => setGreenThreshold(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">
            Ниже этой доли выполнения дорога начинает отворачиваться от цели. Сейчас{' '}
            <span className="text-amber-400">
              {firstVisibleMiss === undefined
                ? 'наклон не появится никогда'
                : `дорогу кладёт ${firstVisibleMiss}-й пропуск подряд`}
            </span>
            . При 0.50 два пропуска подряд стоят ровно ноль; при 0.60 второй уже виден.
          </p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Скорость реакции наклона</span>
            <span className="text-amber-400">{trendResponsePx}px</span>
          </label>
          <input
            type="range"
            min={40}
            max={300}
            step={10}
            value={trendResponsePx}
            onChange={(e) => setTrendResponsePx(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">
            За сколько пути дорога догоняет нужный наклон — меньше значит поворачивает раньше. Сейчас
            выбирает <span className="text-amber-400">{Math.round(gapClosedPerDay * 100)}%</span>{' '}
            отставания за день. Ориентир: у безупречной серии наклон и так гуляет на ±15° от
            декоративной волны, так что всё, что ниже этого, увидеть нельзя.
          </p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Приближение (focus view)</span>
            <span className="text-amber-400">{focusedDaysCount} дней/экран</span>
          </label>
          <input
            type="range"
            min={3}
            max={20}
            step={1}
            value={focusedDaysCount}
            onChange={(e) => setFocusedDaysCount(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Сколько дней помещается по высоте экрана. Меньше — кружки крупнее (сильнее приближено).</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Размер плейсхолдера (неделя)</span>
            <span className="text-amber-400">{weekBoxSizeRatio.toFixed(1)}× кружка</span>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={weekBoxSizeRatio}
            onChange={(e) => setWeekBoxSizeRatio(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Во сколько раз синяя плашка крупнее кружка дня — как у Duolingo, она должна быть соразмерна кружку, а не в разы больше.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Макс. поворот пути в день</span>
            <span className="text-amber-400">{maxTurnPerDay}°</span>
          </label>
          <input
            type="range"
            min={2}
            max={Math.floor(MAX_TURN_PER_DAY_CAP)}
            step={1}
            value={maxTurnPerDay}
            onChange={(e) => setMaxTurnPerDay(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Весь бюджет кривизны пути за день. Меньше — шире радиус разворота (и шире полоса, которую разворот открывает), но медленнее реакция на смену тренда. Потолок ползунка посчитан так, чтобы полоса всегда осталась шире двух кружков.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Радиус избегания</span>
            <span className="text-amber-400">{avoidanceRadius}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={160}
            step={1}
            value={avoidanceRadius}
            onChange={(e) => setAvoidanceRadius(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">С какого расстояния путь начинает отворачивать от собственных старых участков. Больше — уходит в сторону раньше; 0 выключает. Это страховка на дальней дистанции: от наложения при развороте спасает радиус поворота, а не этот ползунок.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Амплитуда волны</span>
            <span className="text-amber-400">{zigzagAmplitude}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={Math.floor(ZIGZAG_AMPLITUDE_CAP)}
            step={1}
            value={zigzagAmplitude}
            onChange={(e) => setZigzagAmplitude(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Насколько далеко змейка уходит вбок от центра своей колонки. 40px — это ровно та амплитуда, что снята с пути Duolingo (±28° по направлению движения).</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Период волны</span>
            <span className="text-amber-400">{zigzagPeriod} дн.</span>
          </label>
          <input
            type="range"
            min={3}
            max={20}
            step={1}
            value={zigzagPeriod}
            onChange={(e) => setZigzagPeriod(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Длина одного полного цикла волны, в днях пути. 8 — снято с Duolingo. В бухтах этой волны (каждые полпериода) садятся недельные плашки.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Сила объезда столкновений</span>
            <span className="text-amber-400">{avoidanceStrength}°</span>
          </label>
          <input
            type="range"
            min={0}
            max={45}
            step={1}
            value={avoidanceStrength}
            onChange={(e) => setAvoidanceStrength(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Насколько сильно путь отворачивает от собственной истории недельной давности. Это страховка: от наложения на развороте защищает радиус поворота, а не это.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Чувствительность виляния</span>
            <span className="text-amber-400">{wobbleSensitivity.toFixed(1)}px/°</span>
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={wobbleSensitivity}
            onChange={(e) => setWobbleSensitivity(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">
            Насколько сильно день, который был лучше или хуже твоей недавней нормы, расширяет или сужает волну.
            Именно ширина волны, а не наклон, показывает «как хорошо идут дела» — наклон зарезервирован под
            «вверх к цели / вниз от неё».
          </p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Макс. виляние</span>
            <span className="text-amber-400">{maxWobble}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={Math.floor(MAX_WOBBLE_CAP)}
            step={1}
            value={maxWobble}
            onChange={(e) => setMaxWobble(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Потолок на то, насколько далеко в сторону может увести это виляние за один день.</p>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border-2 border-dashed border-amber-400 bg-black/90 px-3 py-2 text-amber-400 shadow-xl"
        >
          🛠 dev
        </button>
      )}

      {preview === 'day' && <DayReviewScreen review={dayPreview()} onClose={() => setPreview(null)} />}
      {preview === 'week' && <WeekReviewScreen review={weekPreview()} onClose={() => setPreview(null)} />}
      {preview === 'comeback' && <ComebackCelebration comeback={comebackPreview()} onClose={() => setPreview(null)} />}
      {preview === 'milestone' && (
        <MilestoneCelebration celebration={milestonePreview()} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}
