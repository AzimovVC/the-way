import { useState } from 'react'
import { removeLastDays, simulateFutureDays } from '../domain/dayLifecycle'
import { clearState } from '../storage/appStorage'
import { useAppState } from '../state/AppStateContext'
import {
  setAvoidanceStrength,
  setFocusedDaysCount,
  setMaxTurnPerDay,
  setMaxWobble,
  setMinPointSeparation,
  setScrollPxPerDay,
  setWeekBoxSizeRatio,
  setWobbleSensitivity,
  setZigzagAmplitude,
  setZigzagPeriod,
  useAvoidanceStrength,
  useFocusedDaysCount,
  useMaxTurnPerDay,
  useMaxWobble,
  useMinPointSeparation,
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
  const [days, setDays] = useState(7)
  const [rate, setRate] = useState<number | 'random'>(1)
  const [removeCount, setRemoveCount] = useState(7)
  const maxTurnPerDay = useMaxTurnPerDay()
  const minPointSeparation = useMinPointSeparation()
  const zigzagAmplitude = useZigzagAmplitude()
  const zigzagPeriod = useZigzagPeriod()
  const wobbleSensitivity = useWobbleSensitivity()
  const maxWobble = useMaxWobble()
  const avoidanceStrength = useAvoidanceStrength()
  const scrollPxPerDay = useScrollPxPerDay()
  const focusedDaysCount = useFocusedDaysCount()
  const weekBoxSizeRatio = useWeekBoxSizeRatio()

  function runSimulation() {
    const completionRateFor = rate === 'random' ? () => Math.random() : () => rate
    setState(simulateFutureDays(state, days, completionRateFor))
  }

  const effectiveRemoveCount = Math.min(removeCount, Math.max(1, state.days.length))

  function runRemoval() {
    setState(removeLastDays(state, effectiveRemoveCount))
  }

  function resetAll() {
    if (!confirm('Стереть весь прогресс и начать заново?')) return
    clearState()
    window.location.reload()
  }

  const lastDate = state.days.reduce((max, d) => (d.date > max ? d.date : max), state.days[0]?.date ?? '—')

  return (
    <div className="fixed bottom-3 left-3 z-50 font-sans text-xs" style={{ colorScheme: 'dark' }}>
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
            max={45}
            step={1}
            value={maxTurnPerDay}
            onChange={(e) => setMaxTurnPerDay(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Меньше — путь плавнее и не пересекает сам себя, но медленнее реагирует на смену тренда.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Мин. расстояние между кружками</span>
            <span className="text-amber-400">{minPointSeparation}px</span>
          </label>
          <input
            type="range"
            min={40}
            max={100}
            step={1}
            value={minPointSeparation}
            onChange={(e) => setMinPointSeparation(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Больше — кружки гарантированно дальше друг от друга при резких разворотах.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Амплитуда волны</span>
            <span className="text-amber-400">{zigzagAmplitude}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={zigzagAmplitude}
            onChange={(e) => setZigzagAmplitude(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Больше — путь заметнее уходит влево-вправо от строгой линии, как в Duolingo.</p>

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
          <p className="mt-1 text-white/40">Меньше — путь виляет чаще (крутая змейка), больше — плавные широкие дуги.</p>

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
          <p className="mt-1 text-white/40">Доп. поворот, которым путь заранее огибает соседний кружок вместо резкого сдвига точки.</p>

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
            Насколько сильно день, который был лучше или хуже твоей недавней нормы, толкает путь в сторону —
            независимо от того, растёт тренд или падает.
          </p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Макс. виляние</span>
            <span className="text-amber-400">{maxWobble}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={60}
            step={2}
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
    </div>
  )
}
